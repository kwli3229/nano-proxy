import { readFileSync } from "fs";
import type { Config, PoolConfig, ProviderKey } from "./types";

export function loadConfig(path: string): Config {
  try {
    const content = readFileSync(path, "utf-8");
    const rawConfig = JSON.parse(content);

    // Validate required fields
    if (!rawConfig.port || !rawConfig.apiKeyPools) {
      throw new Error("Invalid configuration: missing required fields");
    }

    // Normalize apiKeyPools to new format
    const normalizedPools: Record<string, PoolConfig> = {};

    for (const [poolName, poolValue] of Object.entries(rawConfig.apiKeyPools)) {
      if (Array.isArray(poolValue)) {
        // Old format: array of ProviderKey
        normalizedPools[poolName] = {
          accepts: [poolName],  // Default: pool name is the accepted key
          keys: poolValue as ProviderKey[]
        };
      } else {
        // New format: PoolConfig object
        const poolConfig = poolValue as PoolConfig;
        normalizedPools[poolName] = {
          accepts: poolConfig.accepts || [poolName],  // Default to pool name if not specified
          keys: poolConfig.keys,
          isStreamingAllowed: poolConfig.isStreamingAllowed,
          transform: poolConfig.transform
        };
      }
    }

    return {
      port: rawConfig.port,
      sessionTimeout: rawConfig.sessionTimeout,
      apiKeyPools: normalizedPools
    };
  } catch (error) {
    throw new Error(`Failed to load config from ${path}: ${error}`);
  }
}
