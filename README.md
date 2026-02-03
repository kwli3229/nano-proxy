# Nano-Proxy

Lightweight API proxy for translating between OpenAI and Anthropic API formats with session-based key rotation.

## Features

- **Format Translation**: Automatic translation between OpenAI and Anthropic formats
- **Key Pool Management**: Rotate through multiple API keys with session stickiness
- **Streaming Support**: Real-time streaming with SSE transformation
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

- `Authorization: Bearer <pool-name>` - Required. The pool name from your config
- `X-Session-ID: <session-id>` - Optional. For session-based key stickiness

## License

MIT
