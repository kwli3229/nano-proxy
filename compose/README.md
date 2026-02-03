# Nano-Proxy Podman Compose

Multi-container setup for nano-proxy with Redis.

## Prerequisites

- Podman and podman-compose installed
- Configuration file at `../config/keys.json`

## Quick Start

### Development

```bash
cd compose
cp .env.example .env
podman-compose -f compose.yaml -f compose.dev.yaml up
```

Hot reload enabled. Edit code and see changes immediately.

### Production

```bash
cd compose
cp .env.example .env
# Edit .env for production settings
podman-compose -f compose.yaml -f compose.prod.yaml up -d
```

Runs in detached mode with health checks and resource limits.

## Configuration

Edit `../config/keys.json` before starting:

```json
{
  "port": 3000,
  "sessionTimeout": 3600000,
  "apiKeyPools": {
    "jan": {
      "accepts": ["jan-api-key-123"],
      "keys": [...]
    }
  }
}
```

## Accessing Services

- **Nano-proxy**: http://localhost:3000
- **Redis**: localhost:6379 (internal network only)

## Common Commands

**View logs:**
```bash
podman-compose logs -f nano-proxy
```

**Restart service:**
```bash
podman-compose restart nano-proxy
```

**Stop all services:**
```bash
podman-compose down
```

**Stop and remove volumes:**
```bash
podman-compose down -v
```

**Rebuild containers:**
```bash
podman-compose -f compose.yaml -f compose.dev.yaml build
```

## Profiles Comparison

| Feature | Development | Production |
|---------|-------------|------------|
| Hot reload | ✅ Yes | ❌ No |
| Volume mounts | ✅ Yes | ❌ No |
| Build optimization | ❌ No | ✅ Multi-stage |
| Health checks | ❌ No | ✅ Yes |
| Resource limits | ❌ No | ✅ Yes |
| Dependencies | All | Production only |

## Redis Integration

Redis container is included but not yet integrated with nano-proxy. Current session management uses in-memory storage.

**Future implementation:**
- Update `src/session-manager.ts` to use Redis
- Use `REDIS_URL` environment variable
- Enable distributed session storage

## Troubleshooting

**Port already in use:**
```bash
# Change port in .env
NANO_PROXY_PORT=3001
```

**Container won't start:**
```bash
# Check logs
podman-compose logs nano-proxy

# Verify config file exists
ls -la ../config/keys.json
```

**Redis connection issues:**
```bash
# Check Redis is running
podman-compose ps
podman-compose logs redis
```
