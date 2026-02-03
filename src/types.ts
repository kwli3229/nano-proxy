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

export interface PoolTransform {
  modelRemap?: Record<string, string[]>;  // anthropic-model → client-models[]
  parameterOverrides?: ParameterOverrides;
}

export interface ParameterOverrides {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  metadata?: Record<string, any>;
}

export interface PoolConfig {
  accepts?: string[];  // Client-facing API keys
  keys: ProviderKey[];
  isStreamingAllowed?: boolean;  // Default: true. Set to false to disable streaming
  transform?: PoolTransform;
}

// Update Config to support both formats
export interface Config {
  port: number;
  sessionTimeout: number;
  apiKeyPools: Record<string, PoolConfig | ProviderKey[]>;
}
