package thingsboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"
)

const requestTimeout = 10 * time.Second

type Client struct {
	baseURL    *url.URL
	apiKey     string
	httpClient *http.Client
}

type Config struct {
	BaseURL string
	APIKey  string
}

func NewClient(cfg Config) (*Client, error) {
	if cfg.BaseURL == "" {
		return nil, errors.New("thingsboard base URL is required")
	}
	if cfg.APIKey == "" {
		return nil, errors.New("thingsboard API key is required")
	}

	parsedURL, err := url.Parse(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse thingsboard base URL: %w", err)
	}

	return &Client{
		baseURL: parsedURL,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: requestTimeout,
		},
	}, nil
}

func (c *Client) CheckStatus(ctx context.Context, assetType string) error {
	query := url.Values{}
	query.Set("pageSize", "1")
	query.Set("page", "0")
	query.Set("type", assetType)

	var response assetPageResponse
	return c.getJSON(ctx, "/api/tenant/assets", query, &response)
}

func (c *Client) ListAssetsByType(ctx context.Context, assetType string) ([]Asset, error) {
	assets := make([]Asset, 0)
	page := 0

	for {
		query := url.Values{}
		query.Set("pageSize", "100")
		query.Set("page", strconv.Itoa(page))
		query.Set("type", assetType)

		var response assetPageResponse
		if err := c.getJSON(ctx, "/api/tenant/assets", query, &response); err != nil {
			return nil, err
		}

		for _, item := range response.Data {
			assets = append(assets, Asset{
				ID:   item.ID.ID,
				Name: item.Name,
				Type: item.Type,
			})
		}

		if !response.HasNext {
			break
		}

		page++
	}

	return assets, nil
}

func (c *Client) GetAssetAttributes(ctx context.Context, assetID string, keys []string) (map[string]string, error) {
	query := url.Values{}
	query.Set("keys", strings.Join(keys, ","))

	var response []attributeKVResponse
	if err := c.getJSON(ctx, "/api/plugins/telemetry/ASSET/"+assetID+"/values/attributes", query, &response); err != nil {
		return nil, err
	}

	attributes := make(map[string]string, len(response))
	for _, item := range response {
		attributes[item.Key] = stringifyValue(item.Value)
	}

	return attributes, nil
}

func (c *Client) GetEntityAttributes(ctx context.Context, entityType string, entityID string, scope string, keys []string) ([]Attribute, error) {
	query := url.Values{}
	if len(keys) > 0 {
		query.Set("keys", strings.Join(keys, ","))
	}

	var response []attributeKVResponse
	if err := c.getJSON(ctx, "/api/plugins/telemetry/"+entityType+"/"+entityID+"/values/attributes/"+scope, query, &response); err != nil {
		return nil, err
	}

	attributes := make([]Attribute, 0, len(response))
	for _, item := range response {
		attributes = append(attributes, Attribute{
			Key:          item.Key,
			Value:        item.Value,
			ValueType:    valueType(item.Value),
			LastUpdateTs: item.LastUpdateTs,
		})
	}

	return attributes, nil
}

func (c *Client) GetAssetRelations(ctx context.Context, assetID string) ([]Relation, error) {
	query := url.Values{}
	query.Set("fromId", assetID)
	query.Set("fromType", "ASSET")

	var response []relationInfoResponse
	if err := c.getJSON(ctx, "/api/relations/info", query, &response); err != nil {
		return nil, err
	}

	relations := make([]Relation, 0, len(response))
	for _, item := range response {
		relations = append(relations, Relation{
			ToID:         item.To.ID,
			ToType:       item.To.EntityType,
			RelationType: item.Type,
		})
	}

	return relations, nil
}

func (c *Client) GetDevice(ctx context.Context, deviceID string) (Device, error) {
	var response deviceResponse
	if err := c.getJSON(ctx, "/api/device/"+deviceID, nil, &response); err != nil {
		return Device{}, err
	}

	return Device{
		ID:    response.ID.ID,
		Name:  response.Name,
		Type:  response.Type,
		Label: response.Label,
		Asset: response.DeviceProfileName,
	}, nil
}

func (c *Client) GetLatestTelemetry(ctx context.Context, deviceID string) ([]TelemetryValue, error) {
	var response map[string][]telemetryValueResponse
	if err := c.getJSON(ctx, "/api/plugins/telemetry/DEVICE/"+deviceID+"/values/timeseries", nil, &response); err != nil {
		return nil, err
	}

	items := make([]TelemetryValue, 0, len(response))
	for key, values := range response {
		if len(values) == 0 {
			continue
		}

		items = append(items, TelemetryValue{
			Key:       key,
			Value:     stringifyValue(values[0].Value),
			Timestamp: values[0].Timestamp,
		})
	}

	return items, nil
}

func (c *Client) GetTelemetryHistory(ctx context.Context, deviceID string, keys []string, startTs int64, endTs int64, interval int64, limit int) ([]TelemetrySeries, error) {
	query := url.Values{}
	if len(keys) > 0 {
		query.Set("keys", strings.Join(keys, ","))
	}
	query.Set("startTs", strconv.FormatInt(startTs, 10))
	query.Set("endTs", strconv.FormatInt(endTs, 10))
	query.Set("interval", strconv.FormatInt(interval, 10))
	query.Set("limit", strconv.Itoa(limit))
	query.Set("agg", "AVG")

	var response map[string][]telemetryValueResponse
	if err := c.getJSON(ctx, "/api/plugins/telemetry/DEVICE/"+deviceID+"/values/timeseries", query, &response); err != nil {
		return nil, err
	}

	series := make([]TelemetrySeries, 0, len(response))
	for key, values := range response {
		points := make([]TelemetryPoint, 0, len(values))
		numericSeries := true

		for _, value := range values {
			rawValue := stringifyValue(value.Value)
			numericValue, numeric := parseNumeric(value.Value)
			if !numeric {
				numericSeries = false
			}

			points = append(points, TelemetryPoint{
				Timestamp: value.Timestamp,
				Value:     numericValue,
				RawValue:  rawValue,
				Numeric:   numeric,
			})
		}

		series = append(series, TelemetrySeries{
			Key:     key,
			Points:  points,
			Numeric: numericSeries && len(points) > 0,
		})
	}

	return series, nil
}

func (c *Client) AcknowledgeAlarm(ctx context.Context, alarmID string) (AlarmInfo, error) {
	var response AlarmInfo
	if err := c.postJSON(ctx, "/api/alarm/"+alarmID+"/ack", nil, &response); err != nil {
		return AlarmInfo{}, err
	}
	return response, nil
}

func (c *Client) ClearAlarm(ctx context.Context, alarmID string) (AlarmInfo, error) {
	var response AlarmInfo
	if err := c.postJSON(ctx, "/api/alarm/"+alarmID+"/clear", nil, &response); err != nil {
		return AlarmInfo{}, err
	}
	return response, nil
}

func (c *Client) getJSON(ctx context.Context, endpoint string, query url.Values, target any) error {
	reqCtx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	requestURL := *c.baseURL
	requestURL.Path = path.Join(requestURL.Path, endpoint)
	requestURL.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, requestURL.String(), nil)
	if err != nil {
		return fmt.Errorf("build thingsboard request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Authorization", "ApiKey "+c.apiKey)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("thingsboard request failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("thingsboard request failed with status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	if err := json.NewDecoder(res.Body).Decode(target); err != nil {
		return fmt.Errorf("decode thingsboard response: %w", err)
	}

	return nil
}

func (c *Client) postJSON(ctx context.Context, endpoint string, body any, target any) error {
	reqCtx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	requestURL := *c.baseURL
	requestURL.Path = path.Join(requestURL.Path, endpoint)

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal thingsboard request body: %w", err)
		}
		reader = strings.NewReader(string(payload))
	}

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, requestURL.String(), reader)
	if err != nil {
		return fmt.Errorf("build thingsboard request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Authorization", "ApiKey "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("thingsboard request failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("thingsboard request failed with status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	if target == nil {
		return nil
	}
	if err := json.NewDecoder(res.Body).Decode(target); err != nil {
		return fmt.Errorf("decode thingsboard response: %w", err)
	}

	return nil
}

func stringifyValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return fmt.Sprint(typed)
	}
}

func parseNumeric(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case string:
		parsed, err := strconv.ParseFloat(typed, 64)
		if err != nil {
			return 0, false
		}

		return parsed, true
	default:
		return 0, false
	}
}

func valueType(value any) string {
	switch value.(type) {
	case nil:
		return "null"
	case bool:
		return "boolean"
	case float64, int, int64:
		return "number"
	case string:
		return "string"
	case []any, map[string]any:
		return "json"
	default:
		return "unknown"
	}
}

type AlarmQuery struct {
	SearchStatus string
	Status       string
	TextSearch   string
	Page         int
	PageSize     int
	SortProperty string
	SortOrder    string
	StartTime    int64
	EndTime      int64
}

type AlarmInfo struct {
	ID                    entityIDResponse `json:"id"`
	CreatedTime           int64            `json:"createdTime"`
	Type                  string           `json:"type"`
	Severity              string           `json:"severity"`
	Status                string           `json:"status"`
	Acknowledged          bool             `json:"acknowledged"`
	Cleared               bool             `json:"cleared"`
	Originator            entityIDResponse `json:"originator"`
	OriginatorName        string           `json:"originatorName"`
	OriginatorLabel       string           `json:"originatorLabel"`
	OriginatorDisplayName string           `json:"originatorDisplayName"`
	StartTs               int64            `json:"startTs"`
	EndTs                 int64            `json:"endTs"`
	AckTs                 int64            `json:"ackTs"`
	ClearTs               int64            `json:"clearTs"`
	Details               json.RawMessage  `json:"details"`
}

type AlarmPage struct {
	Items    []AlarmInfo
	Page     int
	PageSize int
	Total    int64
	HasNext  bool
}

func (c *Client) ListAlarms(ctx context.Context, query AlarmQuery) (AlarmPage, error) {
	q := buildAlarmQuery(query)

	var response alarmPageResponse
	if err := c.getJSON(ctx, "/api/alarms", q, &response); err != nil {
		return AlarmPage{}, err
	}

	return AlarmPage{
		Items:    response.Data,
		Page:     response.Page,
		PageSize: response.PageSize,
		Total:    response.TotalElements,
		HasNext:  response.HasNext,
	}, nil
}

func (c *Client) ListEntityAlarms(ctx context.Context, entityType string, entityID string, query AlarmQuery) (AlarmPage, error) {
	q := buildAlarmQuery(query)

	endpoint := "/api/alarm/" + entityType + "/" + entityID
	var response alarmPageResponse
	if err := c.getJSON(ctx, endpoint, q, &response); err != nil {
		return AlarmPage{}, err
	}

	return AlarmPage{
		Items:    response.Data,
		Page:     response.Page,
		PageSize: response.PageSize,
		Total:    response.TotalElements,
		HasNext:  response.HasNext,
	}, nil
}

func buildAlarmQuery(query AlarmQuery) url.Values {
	q := url.Values{}
	q.Set("page", strconv.Itoa(query.Page))
	q.Set("pageSize", strconv.Itoa(query.PageSize))
	q.Set("fetchOriginator", "true")

	if query.SearchStatus != "" {
		q.Set("searchStatus", query.SearchStatus)
	}
	if query.Status != "" {
		q.Set("status", query.Status)
	}
	if query.TextSearch != "" {
		q.Set("textSearch", query.TextSearch)
	}
	if query.SortProperty != "" {
		q.Set("sortProperty", query.SortProperty)
	}
	if query.SortOrder != "" {
		q.Set("sortOrder", query.SortOrder)
	}
	if query.StartTime > 0 {
		q.Set("startTime", strconv.FormatInt(query.StartTime, 10))
	}
	if query.EndTime > 0 {
		q.Set("endTime", strconv.FormatInt(query.EndTime, 10))
	}
	return q
}

type alarmPageResponse struct {
	Data          []AlarmInfo `json:"data"`
	TotalPages    int         `json:"totalPages"`
	TotalElements int64       `json:"totalElements"`
	HasNext       bool        `json:"hasNext"`
	Page          int         `json:"-"`
	PageSize      int         `json:"-"`
}

type Asset struct {
	ID   string
	Name string
	Type string
}

type Relation struct {
	ToID         string
	ToType       string
	RelationType string
}

type Device struct {
	ID    string
	Name  string
	Type  string
	Label string
	Asset string
}

type TelemetryValue struct {
	Key       string
	Value     string
	Timestamp int64
}

type TelemetryPoint struct {
	Timestamp int64
	Value     float64
	RawValue  string
	Numeric   bool
}

type TelemetrySeries struct {
	Key     string
	Points  []TelemetryPoint
	Numeric bool
}

type Attribute struct {
	Key          string
	Value        any
	ValueType    string
	LastUpdateTs int64
}

type assetPageResponse struct {
	Data    []assetResponse `json:"data"`
	HasNext bool            `json:"hasNext"`
}

type assetResponse struct {
	ID   entityIDResponse `json:"id"`
	Name string           `json:"name"`
	Type string           `json:"type"`
}

type entityIDResponse struct {
	EntityType string `json:"entityType"`
	ID         string `json:"id"`
}

type attributeKVResponse struct {
	Key          string `json:"key"`
	Value        any    `json:"value"`
	LastUpdateTs int64  `json:"lastUpdateTs"`
}

type relationInfoResponse struct {
	Type string           `json:"type"`
	To   entityIDResponse `json:"to"`
}

type deviceResponse struct {
	ID                entityIDResponse `json:"id"`
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	Label             string           `json:"label"`
	DeviceProfileName string           `json:"deviceProfileName"`
}

type telemetryValueResponse struct {
	Timestamp int64 `json:"ts"`
	Value     any   `json:"value"`
}
