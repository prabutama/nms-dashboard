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

func (c *Client) CheckStatus(ctx context.Context) error {
	var response map[string]any
	return c.getJSON(ctx, "/api/auth/user", nil, &response)
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
	req.Header.Set("X-Authorization", "Bearer "+c.apiKey)

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
	Key   string `json:"key"`
	Value any    `json:"value"`
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
