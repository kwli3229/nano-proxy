# Nano-Proxy Design

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Nano-proxy is a lightweight API proxy that provides format translation and API key management for AI model APIs. It acts as middleware between OpenAI-compatible clients and various AI providers (Anthropic, Google AI, etc.), handling format conversion, streaming, and session-based key rotation.

## Core Features

1. **Format Translation**
   - Detect incoming format (OpenAI vs native provider format)
   - Translate OpenAI format → Provider format for requests
   - Translate Provider format → OpenAI format for responses
   - Passthrough native provider format unchanged

2. **API Key Management**
   - User API keys map to pools of real provider keys
   - Session-based key rotation (same session uses same key)
   - Support multiple providers with different authentication methods
   - Each key has its own base URL and console URL

3. **Streaming Support**
   - Transform streaming responses in real-time
   - Convert provider SSE format to OpenAI SSE format
   - Maintain proper chunk structure and finish reasons

4. **Error Handling**
   - Translate provider errors to OpenAI error format
   - Maintain HTTP status codes
   - Handle proxy-level errors gracefully

## Architecture

### Technology Stack

- **Runtime:** Bun (native TypeScript support, faster than Node.js)
- **Framework:** Express.js
- **HTTP Client:** Axios or native fetch
- **Provider SDK:** @anthropic-ai/sdk

### Project Structure

```
nano-proxy/
├── src/
│   ├── index.ts                      # Entry point, Express server
│   ├── config.ts                     # Load and validate configuration
│   ├── session-manager.ts            # Session → key mapping
│   ├── key-pool.ts                   # Key pool management
│   ├── format-detector.ts            # Detect OpenAI vs provider format
│   ├── providers/
│   │   ├── base-provider.ts          # Abstract provider interface
│   │   ├── anthropic-provider.ts     # Anthropic implementation
│   │   └── google-ai-provider.ts     # Google AI (future)
│   ├── translators/
│   │   ├── openai-to-anthropic.ts    # Request translation
│   │   ├── anthropic-to-openai.ts    # Response translation
│   │   └── error-translator.ts       # Error translation
│   ├── streaming/
│   │   └── stream-transformer.ts     # SSE transformation
│   └── proxy-handler.ts              # Main request handler
├── config/
│   └── keys.json                     # API key pools configuration
├── tests/
├── package.json
└── tsconfig.json
```

## Configuration

### keys.json Structure

```json
{
  "port": 3000,
  "sessionTimeout": 3600000,
  "apiKeyPools": {
    "proxy-default": [
      {
        "provider": "anthropic",
        "key": "sk-ant-xxx1",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      },
      {
        "provider": "anthropic",
        "key": "sk-ant-xxx2",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      }
    ],
    "fine": [
      {
        "provider": "anthropic",
        "key": "sk-ant-xxx3",
        "baseUrl": "https://api.anthropic.com",
        "version": "2023-06-01",
        "consoleUrl": "https://console.anthropic.com"
      }
    ],
    "google-ai-pool": [
      {
        "provider": "google-ai",
        "key": "AIzaSy...",
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
        "model": "gemini-pro",
        "consoleUrl": "https://aistudio.google.com/apikey"
      }
    ],
    "vertex-ai-pool": [
      {
        "provider": "vertex-ai",
        "serviceAccountPath": "./credentials/vertex-sa.json",
        "baseUrl": "https://us-central1-aiplatform.googleapis.com/v1",
        "projectId": "my-gcp-project",
        "location": "us-central1",
        "consoleUrl": "https://console.cloud.google.com/vertex-ai"
      }
    ]
  }
}
```

### Provider-Specific Fields

**Anthropic:**
- `key`: API key (sk-ant-...)
- `baseUrl`: API endpoint
- `version`: API version header
- `consoleUrl`: Console dashboard URL

**Google AI Studio:**
- `key`: API key (AIzaSy...)
- `baseUrl`: API endpoint
- `model`: Default model name
- `consoleUrl`: Console dashboard URL

**Vertex AI:**
- `serviceAccountPath`: Path to service account JSON
- `baseUrl`: API endpoint
- `projectId`: GCP project ID
- `location`: GCP region
- `consoleUrl`: Console dashboard URL

## Request Flow

### Complete Flow

1. **Client Request**
   - Client sends: `Authorization: Bearer <user-api-key>`
   - Optional: `X-Session-ID` header for session stickiness
   - Path determines format:
     - `/v1/chat/completions` → OpenAI format
     - `/v1/messages` → Anthropic format

2. **Proxy Processing**
   ```
   Request → Format Detection → User API Key Lookup →
   Key Pool Selection → Session-Based Key Selection →
   Format Translation (if OpenAI) → Provider API Call →
   Response Translation (if OpenAI) → Client Response
   ```

3. **Session Management**
   - Check: `sessionManager.get(sessionId, userApiKey)`
   - If no cache: `keyPool.selectKey(userApiKey)` (round-robin)
   - Store: `sessionManager.set(sessionId, userApiKey, selectedKey)`
   - Auto-expire after timeout (default: 1 hour)

4. **Streaming Flow**
   - Detect `stream: true` in request
   - Open SSE connection to provider
   - Transform each chunk: Provider SSE → OpenAI SSE
   - Pipe to client with `Content-Type: text/event-stream`

5. **Error Flow**
   - Catch provider errors → translate to OpenAI format (if needed)
   - Catch proxy errors → format as OpenAI errors
   - Return with appropriate HTTP status code

## Format Translation

### Format Detection

Detect by request path:
- `/v1/chat/completions` → OpenAI format
- `/v1/messages` → Anthropic format
- Return 404 for unknown paths

### OpenAI → Anthropic Request Translation

```javascript
{
  // Model mapping
  "gpt-4": "claude-opus-4-5",
  "gpt-3.5-turbo": "claude-sonnet-4-5",

  // Direct mappings
  messages: messages,
  max_tokens: max_tokens,
  temperature: temperature,
  stream: stream,
  top_p: top_p,

  // Field transformations
  stop: stop_sequences,

  // Extract system message
  // OpenAI: messages[0].role === "system"
  // Anthropic: separate "system" field
}
```

### Anthropic → OpenAI Response Translation

```javascript
{
  id: message.id,
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model: request.model,

  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: message.content[0].text
    },
    finish_reason: stopReasonMap[message.stop_reason]
  }],

  usage: {
    prompt_tokens: message.usage.input_tokens,
    completion_tokens: message.usage.output_tokens,
    total_tokens: message.usage.input_tokens + message.usage.output_tokens
  }
}
```

### Streaming Translation

**OpenAI Streaming Format:**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**Anthropic Streaming Format:**
```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

**Translation Requirements:**
- Parse Anthropic SSE events
- Map `content_block_delta` → OpenAI chunk with `delta.content`
- Map `message_stop` → final chunk with `finish_reason` + `[DONE]`
- Maintain chunk ID consistency
- Handle errors mid-stream

## Error Handling

### Error Format Translation

**Anthropic Error:**
```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Invalid API key"
  }
}
```

**OpenAI Error:**
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

### Error Type Mappings

```javascript
{
  "invalid_request_error": "invalid_request_error",
  "authentication_error": "invalid_api_key",
  "permission_error": "insufficient_quota",
  "not_found_error": "model_not_found",
  "rate_limit_error": "rate_limit_exceeded",
  "api_error": "server_error",
  "overloaded_error": "server_error"
}
```

### HTTP Status Codes

- 400 → 400 (Bad Request)
- 401 → 401 (Unauthorized)
- 403 → 403 (Forbidden)
- 404 → 404 (Not Found)
- 429 → 429 (Rate Limited)
- 500 → 500 (Server Error)
- 529 → 503 (Service Unavailable)

### Proxy-Level Errors

- Invalid user API key → 401 with OpenAI error format
- No keys available in pool → 503 with OpenAI error format
- Translation errors → 500 with OpenAI error format

## Dependencies

### package.json

```json
{
  "name": "nano-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "@anthropic-ai/sdk": "^0.20.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "bun-types": "latest"
  },
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test"
  }
}
```

## Testing Strategy

### Unit Tests

- Format detection logic
- Request/response translation (OpenAI ↔ Anthropic)
- Error translation
- Session management (key selection, expiration)
- Key pool rotation logic

### Integration Tests

- Mock provider API responses
- Test streaming transformation
- Test session stickiness across requests
- Test different provider configurations

### Manual Testing

- Real OpenAI client (ChatGPT, Cursor, etc.) → proxy → Anthropic
- Native Anthropic client → proxy → Anthropic (passthrough)
- Streaming responses
- Error scenarios (invalid keys, rate limits)

## Deployment

### Development

```bash
bun install
bun --watch src/index.ts  # Auto-reload on changes
```

### Production

```bash
bun install --production
bun src/index.ts
```

### Environment

- Load `keys.json` from config directory
- Support environment variable overrides
- Logging: Request/response logging (sanitize API keys)
- Monitoring: Track key usage, error rates, session counts

### Security Considerations

- Never log real API keys
- Validate user API keys before processing
- Rate limiting per user API key (optional)
- HTTPS in production
- Secure storage of provider credentials

## Future Enhancements (v2+)

1. **Additional Providers**
   - Google Vertex AI support
   - OpenAI API support (for completeness)
   - Azure OpenAI support

2. **Advanced Features**
   - Redis-based session storage for horizontal scaling
   - Request/response caching
   - Usage analytics and billing
   - Admin API for key management
   - Health check endpoints

3. **Performance**
   - Connection pooling
   - Request queuing
   - Load balancing across keys

## Implementation Notes

### Key Components

**ProxyHandler:**
- Orchestrates the entire request flow
- Handles both streaming and non-streaming requests
- Manages error handling and response formatting

**SessionManager:**
- In-memory Map with TTL cleanup
- Maps (sessionId, userApiKey) → selectedProviderKey
- Periodic cleanup of expired sessions

**KeyPool:**
- Round-robin selection within pools
- Tracks usage per key (optional)
- Validates key availability

**Translators:**
- Bidirectional format conversion
- Provider-specific translation logic
- Error format translation

**StreamTransformer:**
- SSE parsing and transformation
- Maintains state across chunks
- Handles streaming errors

## Success Criteria

1. OpenAI-compatible clients can use Anthropic API seamlessly
2. Session-based key rotation works correctly
3. Streaming responses are properly translated
4. Errors are translated to OpenAI format
5. Native Anthropic clients work without translation
6. Configuration supports multiple providers
7. All tests pass
8. Performance is acceptable (< 50ms overhead)
