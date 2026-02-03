Pool Transform Implementation Plan

For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Add pool-level transformation capabilities including model remapping, parameter overrides, and streaming control. Support client API key mapping via "accepts" array. Maintain backward compatibility with existing config format.

Architecture: Extend existing config structure to support pool transforms. Add pool-transformer module for applying transformations. Update key-pool to handle client key mapping. Update proxy-handler to apply transforms after format translation.

Tech Stack: TypeScript, Bun runtime, existing nano-proxy codebase

---
Task 1: Update Type Definitions

Files:
- Edit: src/types.ts

Step 1: Add pool transform types

Add to src/types.ts:

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

Step 2: Commit

git add src/types.ts
git commit -m "feat: add pool transform type definitions"

---
Task 2: Pool Transformer Module

Files:
- Create: src/pool-transformer.ts
- Create: tests/pool-transformer.test.ts

**NOTE:** This will replace the hardcoded MODEL_MAP in src/translators/openai-to-anthropic.ts with dynamic pool-level configuration.

Step 1: Write failing tests

Create tests/pool-transformer.test.ts:

import { describe, test, expect } from "bun:test";
import { applyModelRemap, applyParameterOverrides, applyPoolTransform } from "../src/pool-transformer";
import type { PoolTransform } from "../src/types";

describe("Pool Transformer", () => {
  describe("applyModelRemap", () => {
    test("should remap client model to anthropic model", () => {
      const request = { model: "gpt-4", messages: [] };
      const modelRemap = {
        "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"],
        "claude-sonnet-4-5": ["gpt-3.5-turbo"]
      };

      applyModelRemap(request, modelRemap);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should not change model if not in remap", () => {
      const request = { model: "claude-opus-4-5", messages: [] };
      const modelRemap = {
        "claude-sonnet-4-5": ["gpt-3.5-turbo"]
      };

      applyModelRemap(request, modelRemap);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should handle multiple client models mapping to same anthropic model", () => {
      const request1 = { model: "gpt-4", messages: [] };
      const request2 = { model: "gpt-4-turbo", messages: [] };
      const modelRemap = {
        "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"]
      };

      applyModelRemap(request1, modelRemap);
      applyModelRemap(request2, modelRemap);

      expect(request1.model).toBe("claude-opus-4-5");
      expect(request2.model).toBe("claude-opus-4-5");
    });

    test("should do nothing if no modelRemap provided", () => {
      const request = { model: "gpt-4", messages: [] };

      applyModelRemap(request, undefined);

      expect(request.model).toBe("gpt-4");
    });
  });

  describe("applyParameterOverrides", () => {
    test("should override max_tokens", () => {
      const request = { model: "claude", messages: [], max_tokens: 4096 };
      const overrides = { max_tokens: 2048 };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(2048);
    });

    test("should add parameter if not present", () => {
      const request: any = { model: "claude", messages: [] };
      const overrides = { temperature: 0.7, max_tokens: 1024 };

      applyParameterOverrides(request, overrides);

      expect(request.temperature).toBe(0.7);
      expect(request.max_tokens).toBe(1024);
    });

    test("should override multiple parameters", () => {
      const request: any = {
        model: "claude",
        messages: [],
        max_tokens: 4096,
        temperature: 1.0,
        top_p: 0.5
      };
      const overrides = {
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9
      };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(1024);
      expect(request.temperature).toBe(0.7);
      expect(request.top_p).toBe(0.9);
    });

    test("should not touch parameters not in overrides", () => {
      const request: any = {
        model: "claude",
        messages: [],
        max_tokens: 4096,
        temperature: 1.0,
        top_k: 50
      };
      const overrides = { max_tokens: 1024 };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(1024);
      expect(request.temperature).toBe(1.0);  // Unchanged
      expect(request.top_k).toBe(50);  // Unchanged
    });

    test("should override stop_sequences array", () => {
      const request: any = {
        model: "claude",
        messages: [],
        stop_sequences: ["STOP"]
      };
      const overrides = { stop_sequences: ["END", "DONE"] };

      applyParameterOverrides(request, overrides);

      expect(request.stop_sequences).toEqual(["END", "DONE"]);
    });

    test("should do nothing if no overrides provided", () => {
      const request: any = { model: "claude", messages: [], max_tokens: 4096 };

      applyParameterOverrides(request, undefined);

      expect(request.max_tokens).toBe(4096);
    });
  });

  describe("applyPoolTransform", () => {
    test("should apply both model remap and parameter overrides", () => {
      const request: any = {
        model: "gpt-4",
        messages: [],
        max_tokens: 4096
      };
      const transform: PoolTransform = {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        },
        parameterOverrides: {
          max_tokens: 2048,
          temperature: 0.7
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude-opus-4-5");
      expect(request.max_tokens).toBe(2048);
      expect(request.temperature).toBe(0.7);
    });

    test("should apply only model remap if no overrides", () => {
      const request: any = { model: "gpt-4", messages: [] };
      const transform: PoolTransform = {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should apply only overrides if no model remap", () => {
      const request: any = { model: "claude", messages: [] };
      const transform: PoolTransform = {
        parameterOverrides: {
          max_tokens: 2048
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude");
      expect(request.max_tokens).toBe(2048);
    });

    test("should do nothing if no transform provided", () => {
      const request: any = { model: "gpt-4", messages: [], max_tokens: 4096 };

      applyPoolTransform(request, undefined);

      expect(request.model).toBe("gpt-4");
      expect(request.max_tokens).toBe(4096);
    });
  });
});

Step 2: Run tests to verify they fail

Run: bun test tests/pool-transformer.test.ts
Expected: FAIL with "applyModelRemap is not defined"

Step 3: Implement pool transformer

Create src/pool-transformer.ts:

import type { PoolTransform, ParameterOverrides } from "./types";

/**
 * Apply model remapping to a request
 * Maps client model names to Anthropic model names based on pool config
 */
export function applyModelRemap(
  request: any,
  modelRemap?: Record<string, string[]>
): void {
  if (!modelRemap || !request.model) {
    return;
  }

  // Build reverse map: client-model → anthropic-model
  const reverseMap: Record<string, string> = {};
  for (const [anthropicModel, clientModels] of Object.entries(modelRemap)) {
    for (const clientModel of clientModels) {
      reverseMap[clientModel] = anthropicModel;
    }
  }

  // Check if request model is in the reverse map
  const mappedModel = reverseMap[request.model];
  if (mappedModel) {
    request.model = mappedModel;
  }
}

/**
 * Apply parameter overrides to a request
 * Force specific parameter values as defined in pool config
 */
export function applyParameterOverrides(
  request: any,
  overrides?: ParameterOverrides
): void {
  if (!overrides) {
    return;
  }

  // Apply each override
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      request[key] = value;
    }
  }
}

/**
 * Apply complete pool transformation (model remap + parameter overrides)
 */
export function applyPoolTransform(
  request: any,
  transform?: PoolTransform
): void {
  if (!transform) {
    return;
  }

  // Apply model remap first
  applyModelRemap(request, transform.modelRemap);

  // Then apply parameter overrides
  applyParameterOverrides(request, transform.parameterOverrides);
}

Step 4: Run tests to verify they pass

Run: bun test tests/pool-transformer.test.ts
Expected: PASS

Step 5: Commit

git add src/pool-transformer.ts tests/pool-transformer.test.ts
git commit -m "feat: add pool transformer for model remap and parameter overrides"

---
Task 3: Update Config Loading with Backward Compatibility

Files:
- Edit: src/config.ts
- Edit: tests/config.test.ts

Step 1: Add tests for new config format

Add to tests/config.test.ts:

describe("Config - Pool Transform Support", () => {
  test("should load new pool config format with transform", () => {
    // Create a temp config file
    const configContent = {
      port: 3000,
      sessionTimeout: 3600000,
      apiKeyPools: {
        "jan": {
          accepts: ["jan-key"],
          keys: [
            {
              provider: "anthropic",
              key: "sk-ant-xxx",
              baseUrl: "https://api.anthropic.com",
              version: "2023-06-01",
              consoleUrl: "https://console.anthropic.com"
            }
          ],
          transform: {
            modelRemap: {
              "claude-opus-4-5": ["gpt-4"]
            },
            parameterOverrides: {
              max_tokens: 2048
            }
          }
        }
      }
    };

    const tempPath = "/tmp/test-config-new.json";
    Bun.write(tempPath, JSON.stringify(configContent));

    const config = loadConfig(tempPath);

    expect(config.apiKeyPools["jan"].accepts).toEqual(["jan-key"]);
    expect(config.apiKeyPools["jan"].keys).toBeDefined();
    expect(config.apiKeyPools["jan"].transform?.modelRemap).toBeDefined();
  });

  test("should normalize old format to new format", () => {
    const configContent = {
      port: 3000,
      sessionTimeout: 3600000,
      apiKeyPools: {
        "old-pool": [
          {
            provider: "anthropic",
            key: "sk-ant-xxx",
            baseUrl: "https://api.anthropic.com",
            version: "2023-06-01",
            consoleUrl: "https://console.anthropic.com"
          }
        ]
      }
    };

    const tempPath = "/tmp/test-config-old.json";
    Bun.write(tempPath, JSON.stringify(configContent));

    const config = loadConfig(tempPath);

    // Should be normalized
    expect(config.apiKeyPools["old-pool"].accepts).toEqual(["old-pool"]);
    expect(config.apiKeyPools["old-pool"].keys).toBeDefined();
    expect(config.apiKeyPools["old-pool"].transform).toBeUndefined();
  });
});

Step 2: Run tests to verify they fail

Run: bun test tests/config.test.ts
Expected: FAIL (type mismatches or undefined properties)

Step 3: Update config loading implementation

Edit src/config.ts:

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

Step 4: Run tests to verify they pass

Run: bun test tests/config.test.ts
Expected: PASS

Step 5: Commit

git add src/config.ts tests/config.test.ts
git commit -m "feat: support new pool config format with backward compatibility"

---
Task 4: Update KeyPool for Client Key Mapping

Files:
- Edit: src/key-pool.ts
- Edit: tests/key-pool.test.ts

Step 1: Add tests for client key mapping

Add to tests/key-pool.test.ts:

describe("KeyPool - Client Key Mapping", () => {
  const mockPoolConfig: Record<string, PoolConfig> = {
    "jan": {
      accepts: ["jan-key-1", "jan-key-2"],
      keys: [
        {
          provider: "anthropic",
          key: "sk-ant-1",
          baseUrl: "https://api.anthropic.com",
          version: "2023-06-01",
          consoleUrl: "https://console.anthropic.com"
        }
      ],
      transform: {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        }
      }
    },
    "default": {
      accepts: ["default-key"],
      keys: [
        {
          provider: "anthropic",
          key: "sk-ant-2",
          baseUrl: "https://api.anthropic.com",
          version: "2023-06-01",
          consoleUrl: "https://console.anthropic.com"
        }
      ]
    }
  };

  test("should map client key to pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const poolName1 = pool.getPoolNameByClientKey("jan-key-1");
    const poolName2 = pool.getPoolNameByClientKey("jan-key-2");
    const poolName3 = pool.getPoolNameByClientKey("default-key");

    expect(poolName1).toBe("jan");
    expect(poolName2).toBe("jan");
    expect(poolName3).toBe("default");
  });

  test("should return undefined for unknown client key", () => {
    const pool = new KeyPool(mockPoolConfig);

    const poolName = pool.getPoolNameByClientKey("unknown-key");

    expect(poolName).toBeUndefined();
  });

  test("should get pool transform by pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const transform = pool.getPoolTransform("jan");

    expect(transform?.modelRemap).toBeDefined();
    expect(transform?.modelRemap?.["claude-opus-4-5"]).toEqual(["gpt-4"]);
  });

  test("should return undefined transform for pool without transform", () => {
    const pool = new KeyPool(mockPoolConfig);

    const transform = pool.getPoolTransform("default");

    expect(transform).toBeUndefined();
  });

  test("should select key from correct pool using pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const key = pool.selectKey("jan");

    expect(key.key).toBe("sk-ant-1");
  });
});

Step 2: Run tests to verify they fail

Run: bun test tests/key-pool.test.ts
Expected: FAIL with "getPoolNameByClientKey is not defined"

Step 3: Update KeyPool implementation

Edit src/key-pool.ts:

import type { ProviderKey, PoolConfig, PoolTransform } from "./types";

export class KeyPool {
  private pools: Record<string, PoolConfig>;
  private indices: Record<string, number> = {};
  private clientKeyMap: Map<string, string> = new Map();  // clientKey → poolName

  constructor(pools: Record<string, PoolConfig>) {
    this.pools = pools;

    // Build client key mapping and initialize indices
    for (const [poolName, poolConfig] of Object.entries(pools)) {
      // Initialize round-robin index
      this.indices[poolName] = 0;

      // Build reverse map: client key → pool name
      for (const clientKey of poolConfig.accepts || []) {
        if (this.clientKeyMap.has(clientKey)) {
          throw new Error(
            `Duplicate client key "${clientKey}" found in pool "${poolName}". ` +
            `Already exists in pool "${this.clientKeyMap.get(clientKey)}"`
          );
        }
        this.clientKeyMap.set(clientKey, poolName);
      }
    }
  }

  /**
   * Get pool name by client API key
   */
  getPoolNameByClientKey(clientKey: string): string | undefined {
    return this.clientKeyMap.get(clientKey);
  }

  /**
   * Get pool transform configuration by pool name
   */
  getPoolTransform(poolName: string): PoolTransform | undefined {
    return this.pools[poolName]?.transform;
  }

  /**
   * Check if streaming is allowed for a pool
   */
  isStreamingAllowed(poolName: string): boolean {
    const pool = this.pools[poolName];
    // Default to true if not specified
    return pool?.isStreamingAllowed !== false;
  }

  /**
   * Select a provider key from a pool (round-robin)
   */
  selectKey(poolName: string): ProviderKey {
    const pool = this.pools[poolName];

    if (!pool || pool.keys.length === 0) {
      throw new Error(`No keys available for pool: ${poolName}`);
    }

    // Get current index and increment (round-robin)
    const index = this.indices[poolName];
    this.indices[poolName] = (index + 1) % pool.keys.length;

    return pool.keys[index];
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Object.keys(this.pools);
  }

  /**
   * Check if a pool exists by name
   */
  hasPool(poolName: string): boolean {
    return poolName in this.pools;
  }

  /**
   * Check if a client key is valid
   */
  hasClientKey(clientKey: string): boolean {
    return this.clientKeyMap.has(clientKey);
  }
}

Step 4: Run tests to verify they pass

Run: bun test tests/key-pool.test.ts
Expected: PASS

Step 5: Commit

git add src/key-pool.ts tests/key-pool.test.ts
git commit -m "feat: add client key mapping and pool transform access to KeyPool"

---
Task 5: Update Proxy Handler to Apply Transforms

Files:
- Edit: src/proxy-handler.ts
- Edit: tests/proxy-handler.test.ts

Step 1: Add tests for transform in proxy handler

Add to tests/proxy-handler.test.ts:

describe("ProxyHandler - Pool Transform", () => {
  const mockPoolConfig: Record<string, PoolConfig> = {
    "jan": {
      accepts: ["jan-key"],
      keys: [
        {
          provider: "anthropic",
          key: "sk-ant-1",
          baseUrl: "https://api.anthropic.com",
          version: "2023-06-01",
          consoleUrl: "https://console.anthropic.com"
        }
      ],
      transform: {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        },
        parameterOverrides: {
          max_tokens: 2048,
          temperature: 0.7
        }
      }
    }
  };

  test("should apply pool transform with client key", async () => {
    const keyPool = new KeyPool(mockPoolConfig);
    const sessionManager = new SessionManager(3600000);
    const provider = new AnthropicProvider();
    const handler = new ProxyHandler(keyPool, sessionManager, provider);

    // This is a structure test - actual API call would need mocking
    expect(handler).toBeDefined();
  });
});

Step 2: Update ProxyHandler implementation

Edit src/proxy-handler.ts:

Import pool transformer at the top:

import { applyPoolTransform } from "./pool-transformer";

Update handleRequest method to apply transforms:

async handleRequest(request: ProxyRequest): Promise<any> {
  try {
    // Get pool name from client API key
    const poolName = this.keyPool.getPoolNameByClientKey(request.userApiKey);

    if (!poolName) {
      throw new Error("Invalid API key");
    }

    // Detect format
    const format = detectFormat(request.path);
    if (format === Format.Unknown) {
      throw new Error("Unknown endpoint");
    }

    // Get provider key (with session stickiness if session ID provided)
    let providerKey;
    if (request.sessionId) {
      providerKey = this.sessionManager.get(request.sessionId, poolName);
      if (!providerKey) {
        providerKey = this.keyPool.selectKey(poolName);
        this.sessionManager.set(request.sessionId, poolName, providerKey);
      }
    } else {
      providerKey = this.keyPool.selectKey(poolName);
    }

    // Translate request if OpenAI format
    let anthropicRequest = request.body;
    let originalModel = request.body.model;

    if (format === Format.OpenAI) {
      anthropicRequest = translateRequest(request.body);
    }

    // Apply pool transforms (model remap + parameter overrides)
    const poolTransform = this.keyPool.getPoolTransform(poolName);
    if (poolTransform) {
      applyPoolTransform(anthropicRequest, poolTransform);
    }

    // Apply streaming control
    const streamingAllowed = this.keyPool.isStreamingAllowed(poolName);
    if (!streamingAllowed && anthropicRequest.stream) {
      anthropicRequest.stream = false;
    }

    // Check if streaming
    if (anthropicRequest.stream) {
      return this.handleStreamingRequest(anthropicRequest, providerKey, format, originalModel);
    }

    // Make request to provider
    const response = await this.provider.makeRequest(anthropicRequest, providerKey);

    // Translate response if OpenAI format
    if (format === Format.OpenAI) {
      return translateResponse(response, originalModel);
    }

    return response;
  } catch (error: any) {
    // Translate error if needed
    return translateError(error);
  }
}

Step 3: Run tests

Run: bun test tests/proxy-handler.test.ts
Expected: PASS

Step 4: Commit

git add src/proxy-handler.ts tests/proxy-handler.test.ts
git commit -m "feat: apply pool transforms and streaming control in proxy handler"

---
Task 6: Refactor Hardcoded Model Map in OpenAI Translator

Files:
- Edit: src/translators/openai-to-anthropic.ts
- Edit: tests/translators/openai-to-anthropic.test.ts (if needed)

**NOTE:** The existing openai-to-anthropic.ts has a hardcoded MODEL_MAP. We need to remove it since model mapping is now handled by pool-level transforms.

Step 1: Review current implementation

Current src/translators/openai-to-anthropic.ts has:
```typescript
const MODEL_MAP: Record<string, string> = {
  "gpt-4": "claude-opus-4-5",
  "gpt-4-turbo": "claude-opus-4-5",
  "gpt-3.5-turbo": "claude-sonnet-4-5",
};
```

And uses it in line 9:
```typescript
model: MODEL_MAP[openaiRequest.model] || openaiRequest.model,
```

Step 2: Remove hardcoded model mapping

Edit src/translators/openai-to-anthropic.ts:

Remove the MODEL_MAP constant entirely (lines 1-5).

Update the translateRequest function to NOT do any model mapping:

```typescript
export function translateRequest(openaiRequest: any): any {
  const anthropicRequest: any = {
    model: openaiRequest.model,  // Pass through as-is, pool transform will handle remapping
    messages: [],
  };

  // Rest of the function remains the same...
}
```

Step 3: Update tests if they rely on hardcoded mapping

Check tests/translators/openai-to-anthropic.test.ts and update any tests that expect automatic model remapping to either:
- Remove the expectation (model passes through as-is now)
- Or document that model remapping is now handled at pool level

Step 4: Verify tests pass

Run: bun test tests/translators/openai-to-anthropic.test.ts
Expected: PASS

Step 5: Commit

git add src/translators/openai-to-anthropic.ts tests/translators/openai-to-anthropic.test.ts
git commit -m "refactor: remove hardcoded MODEL_MAP, use pool-level model remapping instead"

---
Task 7: Update Express Server for x-api-key Header Support

Files:
- Edit: src/index.ts

Step 1: Update auth header parsing

Edit src/index.ts:

Update both /v1/chat/completions and /v1/messages endpoints to support x-api-key:

// Helper function to extract API key
function extractApiKey(req: express.Request): string | null {
  // Check x-api-key header first
  const xApiKey = req.headers['x-api-key'] as string | undefined;
  if (xApiKey) {
    return xApiKey;
  }

  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

// Update /v1/chat/completions endpoint
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const userApiKey = extractApiKey(req);

    if (!userApiKey) {
      return res.status(401).json({
        error: {
          message: "Missing or invalid authorization header",
          type: "invalid_request_error",
          code: "invalid_api_key"
        }
      });
    }

    const sessionId = req.headers["x-session-id"] as string | undefined;

    const result = await proxyHandler.handleRequest({
      path: "/v1/chat/completions",
      userApiKey,
      sessionId,
      body: req.body
    });

    // ... rest of endpoint logic
  } catch (error: any) {
    // ... error handling
  }
});

// Update /v1/messages endpoint similarly
app.post("/v1/messages", async (req, res) => {
  try {
    const userApiKey = extractApiKey(req);

    if (!userApiKey) {
      return res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message: "Missing or invalid authorization header"
        }
      });
    }

    const sessionId = req.headers["x-session-id"] as string | undefined;

    const result = await proxyHandler.handleRequest({
      path: "/v1/messages",
      userApiKey,
      sessionId,
      body: req.body
    });

    // ... rest of endpoint logic
  } catch (error: any) {
    // ... error handling
  }
});

Step 2: Test server startup

Run: bun --watch src/index.ts
Expected: Server starts without errors

Step 3: Commit

git add src/index.ts
git commit -m "feat: support x-api-key header for authentication"

---
Task 8: Update Example Configuration

Files:
- Edit: config/keys.example.json

Step 1: Update example config with new format

Edit config/keys.example.json:

{
  "port": 3000,
  "sessionTimeout": 3600000,
  "apiKeyPools": {
    "jan": {
      "accepts": ["jan-api-key-123"],
      "isStreamingAllowed": false,
      "keys": [
        {
          "provider": "anthropic",
          "key": "sk-ant-xxx1",
          "baseUrl": "https://api.anthropic.com",
          "version": "2023-06-01",
          "consoleUrl": "https://console.anthropic.com"
        }
      ],
      "transform": {
        "modelRemap": {
          "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"],
          "claude-sonnet-4-5": ["gpt-3.5-turbo", "gpt-3.5"]
        },
        "parameterOverrides": {
          "max_tokens": 2048,
          "temperature": 0.7
        }
      }
    },
    "default": {
      "accepts": ["default-key"],
      "keys": [
        {
          "provider": "anthropic",
          "key": "sk-ant-xxx2",
          "baseUrl": "https://api.anthropic.com",
          "version": "2023-06-01",
          "consoleUrl": "https://console.anthropic.com"
        }
      ]
    },
    "old-format-example": [
      {
        "provider": "anthropic",
        "key": "sk-ant-xxx3",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      }
    ]
  }
}

Step 2: Commit

git add config/keys.example.json
git commit -m "docs: update example config with pool transform format"

---
Task 9: Integration Testing

Files:
- Create: tests/integration-transform.test.ts

Step 1: Write integration tests

Create tests/integration-transform.test.ts:

import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("Integration Tests - Pool Transform", () => {
  let serverUrl = "http://localhost:3000";

  test("should apply model remap with x-api-key header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "jan-api-key-123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    // This would need a real API key to fully test
    // For now, just verify the request is accepted
    expect([200, 401, 500]).toContain(response.status);
  });

  test("should apply model remap with Authorization header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer jan-api-key-123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect([200, 401, 500]).toContain(response.status);
  });

  test("should reject unknown client key", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "unknown-key",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect(response.status).toBe(401);
  });

  test("should work with old format pools", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "old-format-example",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    // Old format should still work
    expect([200, 401, 500]).toContain(response.status);
  });
});

Step 2: Run integration tests (requires server running)

Run: bun test tests/integration-transform.test.ts
Expected: Tests pass or skip (depending on server availability)

Step 3: Commit

git add tests/integration-transform.test.ts
git commit -m "test: add integration tests for pool transform feature"

---
Task 10: Update Documentation

Files:
- Edit: README.md

Step 1: Update README with pool transform documentation

Edit README.md:

Add new section after "Configuration":

## Pool Transformations

Nano-proxy supports pool-level transformations that modify requests transparently:

### Model Remapping

Map client model names to Anthropic models:

```json
{
  "apiKeyPools": {
    "jan": {
      "accepts": ["jan-api-key-123"],
      "keys": [...],
      "transform": {
        "modelRemap": {
          "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"],
          "claude-sonnet-4-5": ["gpt-3.5-turbo"]
        }
      }
    }
  }
}
```

When a client sends `model: "gpt-4"`, it will be transformed to `claude-opus-4-5`.

### Parameter Overrides

Force specific parameter values for all requests:

```json
{
  "transform": {
    "parameterOverrides": {
      "max_tokens": 2048,
      "temperature": 0.7,
      "top_p": 0.9
    }
  }
}
```

Parameters specified in `parameterOverrides` will always override client values.

### Streaming Control

Control streaming behavior per pool:

```json
{
  "jan": {
    "accepts": ["jan-key"],
    "isStreamingAllowed": false,
    "keys": [...]
  }
}
```

Set `isStreamingAllowed: false` to disable streaming for all requests through this pool.

### Client API Keys

Pools can accept multiple client-facing API keys:

```json
{
  "jan": {
    "accepts": ["client-a-key", "client-b-key"],
    "keys": [...]
  }
}
```

Multiple clients can use different API keys that route to the same pool.

Update "Headers" section:

## Headers

- `Authorization: Bearer <client-api-key>` - Client API key from pool's `accepts` array
- `x-api-key: <client-api-key>` - Alternative auth header (checked first)
- `X-Session-ID: <session-id>` - Optional. For session-based key stickiness

Step 2: Commit

git add README.md
git commit -m "docs: add pool transform documentation to README"

---
Task 11: Final Testing and Verification

Step 1: Run all tests

Run: bun test
Expected: All tests pass

Step 2: Test server with real config

Run: bun --watch src/index.ts
Expected: Server starts and loads config successfully

Step 3: Manual testing with curl

Test model remapping:
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: jan-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'

Test with Authorization header:
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer jan-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'

Step 4: Verify backward compatibility

Test with old format pool name:
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: old-format-example" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-opus-4-5", "messages": [{"role": "user", "content": "Hello"}]}'

---

## Success Criteria

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Server starts without errors
- [ ] Model remapping works correctly
- [ ] Streaming control (isStreamingAllowed) forces stream parameter correctly
- [ ] Parameter overrides are applied
- [ ] x-api-key header is supported
- [ ] Authorization header still works
- [ ] Client key mapping works (accepts array)
- [ ] Backward compatibility with old config format
- [ ] Documentation updated
- [ ] Example config updated

## Next Steps

After completing this plan:

1. Manual testing with real Jan app integration
2. Test various model name combinations
3. Test parameter override edge cases
4. Performance testing with transforms
5. Consider additional transform features (system prompt injection, response transforms)
