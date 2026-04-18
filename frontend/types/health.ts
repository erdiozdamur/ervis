export type HealthResponse = {
  status: 'ok';
  service: string;
  environment: 'development' | 'test' | 'production';
  timeZone: string;
  dayKey: string;
  timestamp: string;
  checks: {
    databaseConfigured: boolean;
    authSecretConfigured: boolean;
    authUrlConfigured: boolean;
  };
};
