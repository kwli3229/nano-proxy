# Pool-Level Transformation Design

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Add pool-level transformation capabilities to nano-proxy that allow transparent request modification including model remapping and parameter overrides. Each pool can define transformation rules that apply to all requests routed through that pool.

## Goals

1. **Model remapping** - Map client model names (e.g., `gpt-4`) to Anthropic models (e.g., `claude-opus-4-5`)
2. **Parameter overrides** - Force specific parameter values for requests (e.g., always use `max_tokens: 2048`)
3. **Streaming control** - Allow pools to enable/disable streaming capabilities
4. **Client API key flexibility** - Allow pools to accept multiple client-facing API keys
5. **Backward compatibility** - Support existing configuration format

## Key Principles

1. **Explicit overrides only** - Pool transforms only apply to parameters explicitly defined in the transform config
2. **Native Anthropic format** - All config uses Anthropic's native parameter names and image formats
3. **Transparent to clients** - Transformations happen at the proxy layer, clients don't know about them
4. **Per-pool configuration** - Each pool can have different transformation rules

## Configuration Structure

### New Format

```json
{
  "port": 3000,
  "sessionTimeout": 3600000,
  "apiKeyPools": {
    "jan": {
      "accepts": ["jan-api-key-123", "another-key"],
      "isStreamingAllowed": false,
      "keys": [
        {
          "provider": "anthropic",
          "key": "sk-ant-xxx",
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
          "temperature": 0.7,
          "top_p": 0.9
        }
      }
    },
    "default": {
      "accepts": ["default-key"],
      "keys": [
        {
          "provider": "anthropic",
          "key": "sk-ant-yyy",
          "baseUrl": "https://api.anthropic.com",
          "version": "2023-06-01",
          "consoleUrl": "https://console.anthropic.com"
        }
      ]
    }
  }
}
```

### Old Format (Still Supported)

```json
{
  "apiKeyPools": {
    "jan": [
      {
        "provider": "anthropic",
        "key": "sk-ant-xxx",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      }
    ]
  }
}
```

## Feature Details

### 1. Client API Key Mapping

**Purpose:** Allow pools to accept multiple client-facing API keys that map to the same pool.

**Configuration:**
```json
"accepts": ["jan-api-key-123", "another-key"]
```

**Behavior:**
- Client sends `x-api-key: jan-api-key-123` OR `Authorization: Bearer jan-api-key-123`
- Proxy searches all pools to find one where the key is in the `accepts` array
- Routes request to that pool and applies its transformations
- If `accepts` is not defined, the pool name itself is used as the accepted key (backward compatibility)

**Authentication Header Support:**
1. `x-api-key: <key>` (primary)
2. `Authorization: Bearer <key>` (fallback)

Check `x-api-key` first, then `Authorization` header.

### 2. Model Remapping

**Purpose:** Map client model names to actual Anthropic model names.

**Configuration:**
```json
"modelRemap": {
  "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"],
  "claude-sonnet-4-5": ["gpt-3.5-turbo", "gpt-3.5"]
}
```

**Format:** `{ "<anthropic-model>": ["<client-model-1>", "<client-model-2>"] }`

**Behavior:**
- Reverse lookup: If client sends `gpt-4`, find which Anthropic model has `gpt-4` in its array
- Replace request model with the Anthropic model
- If no match found in remap, pass through unchanged
- Applied AFTER format translation (OpenAI→Anthropic) but BEFORE parameter overrides

**Examples:**

| Client Sends | Pool Remap | Result |
|--------------|------------|--------|
| `gpt-4` | `claude-opus-4-5: ["gpt-4"]` | `claude-opus-4-5` |
| `claude-sonnet-4-5` | No remap for this model | `claude-sonnet-4-5` (unchanged) |
| `gpt-3.5-turbo` | `claude-sonnet-4-5: ["gpt-3.5-turbo"]` | `claude-sonnet-4-5` |

### 3. Streaming Control

**Purpose:** Enable or disable streaming for all requests through this pool.

**Configuration:**
```json
"isStreamingAllowed": false
```

**Behavior:**
- If `isStreamingAllowed: false` → Force `stream: false` in all requests, ignore client's stream parameter
- If `isStreamingAllowed: true` or undefined (default) → Allow streaming, respect client's stream parameter
- Applied AFTER format translation, as part of request processing
- Streaming requests will be converted to non-streaming requests if disabled

**Examples:**

| Pool Setting | Client Sends | Result |
|--------------|--------------|--------|
| `isStreamingAllowed: false` | `stream: true` | `stream: false` (forced off) |
| `isStreamingAllowed: false` | `stream: false` | `stream: false` (unchanged) |
| `isStreamingAllowed: true` | `stream: true` | `stream: true` (allowed) |
| Not specified (default: true) | `stream: true` | `stream: true` (allowed) |

### 4. Parameter Overrides

**Purpose:** Force specific parameter values for all requests through this pool.

**Configuration:**
```json
"parameterOverrides": {
  "max_tokens": 2048,
  "temperature": 0.7,
  "top_p": 0.9
}
```

**Supported Parameters:**
- `max_tokens` - Maximum tokens to generate (integer)
- `temperature` - Randomness 0-1 (number)
- `top_p` - Nucleus sampling threshold (number)
- `top_k` - Top-k sampling limit (integer)
- `stop_sequences` - Array of stop sequences (string[])
- `metadata` - Metadata object (object)

**Behavior:**
- For each parameter in `parameterOverrides`, replace the request parameter with the pool's value
- If client didn't send the parameter, it gets added
- If client sent the parameter, it gets overridden
- Parameters NOT in `parameterOverrides` pass through unchanged
- Applied AFTER model remapping

**Examples:**

| Pool Override | Client Sends | Result |
|---------------|--------------|--------|
| `max_tokens: 2048` | `max_tokens: 4096` | `max_tokens: 2048` (overridden) |
| `temperature: 0.7` | No temperature | `temperature: 0.7` (added) |
| No `top_p` override | `top_p: 0.95` | `top_p: 0.95` (unchanged) |
| `stop_sequences: ["END"]` | `stop_sequences: ["STOP"]` | `stop_sequences: ["END"]` (overridden) |

## Request Processing Flow

```
1. Client Request
   ↓
2. Extract API Key (x-api-key OR Authorization: Bearer)
   ↓
3. Find Pool (search accepts arrays OR pool name)
   ↓
4. Format Detection (/v1/chat/completions vs /v1/messages)
   ↓
5. Format Translation (OpenAI → Anthropic, if needed)
   ↓
6. Pool Transform
   ├─ 6a. Model Remapping (if pool has modelRemap)
   ├─ 6b. Streaming Control (if pool has isStreamingAllowed)
   └─ 6c. Parameter Overrides (if pool has parameterOverrides)
   ↓
7. Session Management (get provider key)
   ↓
8. Provider API Call
   ↓
9. Response Translation (if OpenAI format requested)
   ↓
10. Client Response
```

## Implementation Components

### 1. Type Definitions

**New types:**
```typescript
interface PoolTransform {
  modelRemap?: Record<string, string[]>;  // anthropic-model → client-models[]
  parameterOverrides?: ParameterOverrides;
}

interface ParameterOverrides {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  metadata?: Record<string, any>;
}

interface PoolConfig {
  accepts?: string[];  // Client-facing API keys
  keys: ProviderKey[];
  isStreamingAllowed?: boolean;  // Default: true. Set to false to disable streaming
  transform?: PoolTransform;
}

// Config now maps to PoolConfig OR ProviderKey[] for backward compat
type ApiKeyPools = Record<string, PoolConfig | ProviderKey[]>;
```

### 2. Config Loading

**Update `src/config.ts`:**
- Support both old format (array) and new format (object)
- Normalize old format to new format internally
- If pool is array, convert to `{ keys: array, accepts: [poolName] }`

### 3. Pool Transformer Module

**New file: `src/pool-transformer.ts`**
- `applyModelRemap(request, modelRemap)` - Apply model remapping
- `applyParameterOverrides(request, overrides)` - Apply parameter overrides
- `applyPoolTransform(request, transform)` - Apply both transformations

### 4. Key Pool Updates

**Update `src/key-pool.ts`:**
- Accept new `PoolConfig` structure
- Build reverse map: `clientApiKey` → `poolName`
- Expose `getPoolByClientKey(clientKey)` method
- Expose `getPoolTransform(poolName)` method
- Expose `isStreamingAllowed(poolName)` method

### 5. Proxy Handler Updates

**Update `src/proxy-handler.ts`:**
- Import and use pool transformer
- Check `isStreamingAllowed` flag before allowing streaming
- Apply transforms after format translation, before provider call
- Pass pool transform config to transformer

### 6. Auth Header Support

**Update `src/index.ts`:**
- Check `x-api-key` header first
- Fallback to `Authorization: Bearer` header
- Extract and validate client API key

### 7. Tests

**New tests:**
- `tests/pool-transformer.test.ts` - Test model remap and param override logic
- Update `tests/key-pool.test.ts` - Test new PoolConfig format and streaming control
- Update `tests/config.test.ts` - Test backward compatibility
- Update `tests/proxy-handler.test.ts` - Test end-to-end transform flow with streaming control

## Backward Compatibility

**Old config format still works:**

```json
{
  "apiKeyPools": {
    "jan": [{ "provider": "anthropic", "key": "sk-ant-xxx", ... }]
  }
}
```

**Internally normalized to:**

```json
{
  "apiKeyPools": {
    "jan": {
      "accepts": ["jan"],
      "keys": [{ "provider": "anthropic", "key": "sk-ant-xxx", ... }]
    }
  }
}
```

**Behavior:**
- If pool is an array, treat as old format
- No transforms applied (backward compatible)
- Pool name itself is the accepted client API key

## Example Use Cases

### Use Case 1: Jan App Integration

**Goal:** Jan app sends `gpt-4` but wants to use Claude Opus

**Config:**
```json
"jan": {
  "accepts": ["jan-api-key-123"],
  "isStreamingAllowed": false,
  "keys": [{ "provider": "anthropic", "key": "sk-ant-xxx", ... }],
  "transform": {
    "modelRemap": {
      "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"]
    }
  }
}
```

**Flow:**
- Jan sends: `x-api-key: jan-api-key-123` + `model: "gpt-4"` + `stream: true`
- Proxy: Maps to "jan" pool → remaps `gpt-4` → `claude-opus-4-5` → forces `stream: false`
- Anthropic receives: `model: "claude-opus-4-5"` + `stream: false`

### Use Case 2: Rate Limiting via Token Control

**Goal:** Limit all requests to 1024 tokens max

**Config:**
```json
"limited": {
  "accepts": ["limited-key"],
  "keys": [{ "provider": "anthropic", "key": "sk-ant-yyy", ... }],
  "transform": {
    "parameterOverrides": {
      "max_tokens": 1024
    }
  }
}
```

**Flow:**
- Client sends: `x-api-key: limited-key` + `max_tokens: 4096`
- Proxy: Overrides to `max_tokens: 1024`
- Anthropic receives: `max_tokens: 1024`

### Use Case 3: Consistent Temperature

**Goal:** Always use temperature 0.7 for consistent outputs

**Config:**
```json
"consistent": {
  "accepts": ["consistent-key"],
  "keys": [{ "provider": "anthropic", "key": "sk-ant-zzz", ... }],
  "transform": {
    "parameterOverrides": {
      "temperature": 0.7,
      "top_p": 1.0
    }
  }
}
```

### Use Case 4: Multiple Client Keys, Same Pool

**Goal:** Allow multiple API keys to access the same pool

**Config:**
```json
"shared": {
  "accepts": ["client-a-key", "client-b-key", "client-c-key"],
  "keys": [{ "provider": "anthropic", "key": "sk-ant-shared", ... }]
}
```

### Use Case 5: Disable Streaming for Stability

**Goal:** Prevent streaming for certain clients/pools to ensure stable responses

**Config:**
```json
"no-stream": {
  "accepts": ["stable-key"],
  "isStreamingAllowed": false,
  "keys": [{ "provider": "anthropic", "key": "sk-ant-stable", ... }]
}
```

**Flow:**
- Client sends: `x-api-key: stable-key` + `stream: true`
- Proxy: Forces `stream: false`
- Anthropic receives: Non-streaming request
- Client receives: Complete response (not streamed)

## Testing Strategy

### Unit Tests

1. **Pool Transformer** (`tests/pool-transformer.test.ts`)
   - Model remapping with various inputs
   - Parameter overrides for each supported parameter
   - No transform when config is empty
   - Combination of model remap + parameter overrides

2. **Config Loading** (`tests/config.test.ts`)
   - Load new format with transforms
   - Load old format (backward compat)
   - Normalize old format to new format
   - Validate transform structure

3. **Key Pool** (`tests/key-pool.test.ts`)
   - Map client keys to pools via `accepts` array
   - Get pool transform by pool name
   - Handle both old and new formats
   - Multiple pools with overlapping accepts (should error)

### Integration Tests

1. **End-to-End Transform** (`tests/integration.test.ts`)
   - Client sends request with `x-api-key`
   - Model remapping applied
   - Parameter overrides applied
   - Correct provider key selected
   - Response returned

2. **Auth Header Support** (`tests/integration.test.ts`)
   - Test `x-api-key` header
   - Test `Authorization: Bearer` header
   - Test precedence (x-api-key first)

### Manual Testing

1. Real Jan app integration
2. Test with different model names
3. Test parameter overrides with various combinations
4. Test backward compatibility with old config

## Success Criteria

- [ ] Pool accepts array maps client keys to pools correctly
- [ ] Both `x-api-key` and `Authorization: Bearer` headers work
- [ ] Model remapping transforms client models to Anthropic models
- [ ] Streaming control (isStreamingAllowed) forces stream parameter correctly
- [ ] Parameter overrides force specified values
- [ ] Parameters not in overrides pass through unchanged
- [ ] Old config format still works (backward compatible)
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Documentation updated

## Future Enhancements (v2+)

1. **Regex model remapping** - Allow pattern matching for model names
2. **Conditional overrides** - Override based on request properties
3. **Response transformations** - Modify responses before sending to client
4. **System prompt injection** - Add/prepend system prompts
5. **Request validation** - Reject requests that don't meet criteria
6. **Usage quotas** - Track and limit usage per client key
