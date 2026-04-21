export type HealthResponse = {
  status: 'ok';
  service: string;
  environment: 'development' | 'test' | 'staging' | 'production';
  timeZone: string;
  dayKey: string;
  timestamp: string;
  checks: {
    databaseConfigured: boolean;
    authSecretConfigured: boolean;
    authUrlConfigured: boolean;
    managedSecrets: {
      authSecret: {
        configured: boolean;
        source: 'env' | 'secret_manager';
        lastRotatedAt: string | null;
      };
      openAiApiKey: {
        configured: boolean;
        source: 'env' | 'secret_manager';
        lastRotatedAt: string | null;
      };
    };
  };
};
