package server

import (
	"context"

	"github.com/isapr/nms-dashboard/apps/bff/internal/thingsboard"
)

func (s *apiServer) tbCheckStatus(ctx context.Context, assetType string) error {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.CheckStatusWithBearer(ctx, token, assetType)
	}
	return s.tb.CheckStatus(ctx, assetType)
}

func (s *apiServer) tbListAssetsByType(ctx context.Context, assetType string) ([]thingsboard.Asset, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.ListAssetsByTypeWithBearer(ctx, token, assetType)
	}
	return s.tb.ListAssetsByType(ctx, assetType)
}

func (s *apiServer) tbGetAssetAttributes(ctx context.Context, assetID string, keys []string) (map[string]string, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetAssetAttributesWithBearer(ctx, token, assetID, keys)
	}
	return s.tb.GetAssetAttributes(ctx, assetID, keys)
}

func (s *apiServer) tbGetEntityAttributes(ctx context.Context, entityType string, entityID string, scope string, keys []string) ([]thingsboard.Attribute, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetEntityAttributesWithBearer(ctx, token, entityType, entityID, scope, keys)
	}
	return s.tb.GetEntityAttributes(ctx, entityType, entityID, scope, keys)
}

func (s *apiServer) tbGetAssetRelations(ctx context.Context, assetID string) ([]thingsboard.Relation, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetAssetRelationsWithBearer(ctx, token, assetID)
	}
	return s.tb.GetAssetRelations(ctx, assetID)
}

func (s *apiServer) tbGetDevice(ctx context.Context, deviceID string) (thingsboard.Device, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetDeviceWithBearer(ctx, token, deviceID)
	}
	return s.tb.GetDevice(ctx, deviceID)
}

func (s *apiServer) tbGetLatestTelemetry(ctx context.Context, deviceID string) ([]thingsboard.TelemetryValue, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetLatestTelemetryWithBearer(ctx, token, deviceID)
	}
	return s.tb.GetLatestTelemetry(ctx, deviceID)
}

func (s *apiServer) tbGetTelemetryHistory(ctx context.Context, deviceID string, keys []string, startTs int64, endTs int64, interval int64, limit int) ([]thingsboard.TelemetrySeries, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.GetTelemetryHistoryWithBearer(ctx, token, deviceID, keys, startTs, endTs, interval, limit)
	}
	return s.tb.GetTelemetryHistory(ctx, deviceID, keys, startTs, endTs, interval, limit)
}

func (s *apiServer) tbListAlarms(ctx context.Context, query thingsboard.AlarmQuery) (thingsboard.AlarmPage, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.ListAlarmsWithBearer(ctx, token, query)
	}
	return s.tb.ListAlarms(ctx, query)
}

func (s *apiServer) tbListEntityAlarms(ctx context.Context, entityType string, entityID string, query thingsboard.AlarmQuery) (thingsboard.AlarmPage, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.ListEntityAlarmsWithBearer(ctx, token, entityType, entityID, query)
	}
	return s.tb.ListEntityAlarms(ctx, entityType, entityID, query)
}

func (s *apiServer) tbAckAlarm(ctx context.Context, alarmID string) (thingsboard.AlarmInfo, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.AcknowledgeAlarmWithBearer(ctx, token, alarmID)
	}
	return s.tb.AcknowledgeAlarm(ctx, alarmID)
}

func (s *apiServer) tbClearAlarm(ctx context.Context, alarmID string) (thingsboard.AlarmInfo, error) {
	observeTBCall(ctx)
	if token, ok := authTokenFromContext(ctx); ok {
		return s.tb.ClearAlarmWithBearer(ctx, token, alarmID)
	}
	return s.tb.ClearAlarm(ctx, alarmID)
}
