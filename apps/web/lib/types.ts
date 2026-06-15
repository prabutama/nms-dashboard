export type HealthResponse = {
  service: string;
  status: string;
  timestamp: string;
  version: string;
  phase: string;
  config: {
    port: string;
    cacheTtlSeconds: number;
    thingsBoardBaseUrlSet: boolean;
    thingsBoardApiKeySet: boolean;
    thingsBoardConfigured: boolean;
    thingsBoardClientEnabled: boolean;
    thingsBoardSiteAssetType: string;
  };
};

export type Site = {
  siteKey: string;
  assetId: string;
  name: string;
  type: string;
};

export type SitesResponse = {
  items: Site[];
};
