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
  };
};
