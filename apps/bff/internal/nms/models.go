package nms

type Site struct {
	SiteKey string `json:"siteKey"`
	AssetID string `json:"assetId"`
	Name    string `json:"name"`
	Type    string `json:"type"`
}

type Device struct {
	DeviceID     string `json:"deviceId"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Label        string `json:"label,omitempty"`
	RelationType string `json:"relationType"`
}
