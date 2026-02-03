# Nano-Proxy

Lightweight API proxy for translating between OpenAI and Anthropic API formats with session-based key rotation.

## Features

- **Format Translation**: Automatic translation between OpenAI and Anthropic formats
- **Key Pool Management**: Rotate through multiple API keys with session stickiness
- **Streaming Support**: Real-time streaming with SSE transformation
- **Pool Transformations**: Model remapping, parameter overrides, and streaming control at the pool level
- **Multi-Provider**: Support for Anthropic, Google AI (future), Vertex AI (future)

## Installation

```bash
bun install
```

## Configuration

1. Copy example configuration:
```bash
cp config/keys.example.json config/keys.json
```

2. Edit `config/keys.json` with your API keys:
```json
{
  "port": 3000,
  "sessionTimeout": 3600000,
  "apiKeyPools": {
    "my-pool": [
      {
        "provider": "anthropic",
        "key": "sk-ant-your-key",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      }
    ]
  }
}
```

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

## Usage

### Development

```bash
bun --watch src/index.ts
```

### Production

```bash
bun src/index.ts
```

### Testing

```bash
bun test
```

## API Endpoints

### OpenAI Format

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer my-pool" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: user-123" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Anthropic Format

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer my-pool" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: user-123" \
  -d '{
    "model": "claude-opus-4-5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Headers

- `Authorization: Bearer <client-api-key>` - Client API key from pool's `accepts` array
- `x-api-key: <client-api-key>` - Alternative auth header (checked first)
- `X-Session-ID: <session-id>` - Optional. For session-based key stickiness

## License

MIT
