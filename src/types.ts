export interface ProviderKey {
  provider: string;
  key: string;
  baseUrl: string;
  version?: string;
  consoleUrl: string;
  model?: string;
  projectId?: string;
  location?: string;
  serviceAccountPath?: string;
}

export interface Config {
  port: number;
  sessionTimeout: number;
  apiKeyPools: Record<string, ProviderKey[]>;
}
