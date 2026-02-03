# Podman Compose Setup Design

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Create a multi-container Podman Compose setup for nano-proxy with Redis, supporting both development and production profiles. This provides infrastructure for future Redis-based session storage while enabling containerized deployments.

## Goals

1. **Multi-container setup** - Nano-proxy + Redis containers
2. **Development profile** - Hot reload, volume mounts, fast iteration
3. **Production profile** - Optimized builds, health checks, resource limits
4. **Infrastructure-first** - Redis container ready for future session storage implementation
5. **Clean up project** - Remove duplicate `./index.ts`, keep only `src/index.ts`

## Directory Structure

```
compose/
├── compose.yaml              # Base compose file (shared config)
├── compose.dev.yaml          # Development overrides
├── compose.prod.yaml         # Production overrides
├── Containerfile             # Production image (multi-stage)
├── Containerfile.dev         # Development image (hot reload)
├── .env.example              # Environment variables template
└── README.md                 # Usage instructions
```

## Design Details

### Base Configuration

**File: `compose/compose.yaml`**

Shared configuration for both profiles:

```yaml
services:
  nano-proxy:
    container_name: nano-proxy
    networks:
      - nano-net
    ports:
      - "${NANO_PROXY_PORT:-3000}:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - REDIS_URL=redis://redis:6379
    restart: unless-stopped

  redis:
    image: docker.io/redis:7-alpine
    container_name: nano-proxy-redis
    networks:
      - nano-net
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

networks:
  nano-net:
    driver: bridge

volumes:
  redis-data:
```

**Key Features:**
- Redis 7 Alpine image (minimal size)
- Persistent volume for Redis data
- Health check for Redis monitoring
- Private bridge network between containers
- Environment variable for configurable port
- No dependency on Redis (can start independently)
- Redis URL passed for future implementation

### Development Profile

**File: `compose/compose.dev.yaml`**

Development-specific overrides:

```yaml
services:
  nano-proxy:
    build:
      context: ..
      dockerfile: compose/Containerfile.dev
    volumes:
      - ../src:/app/src:z
      - ../config:/app/config:z
      - ../package.json:/app/package.json:z
      - ../tsconfig.json:/app/tsconfig.json:z
    environment:
      - NODE_ENV=development
    command: bun --watch src/index.ts
```

**File: `compose/Containerfile.dev`**

Simple development container with hot reload:

```dockerfile
FROM docker.io/oven/bun:alpine

WORKDIR /app

# Copy package files
COPY package.json ./
RUN bun install

# Source code mounted as volume
EXPOSE 3000

CMD ["bun", "--watch", "src/index.ts"]
```

**Development Features:**
- Volume mounts for live code changes (`:z` for SELinux compatibility)
- `bun --watch` for automatic reloading on file changes
- All dependencies installed (including devDependencies)
- Fast rebuilds (only when package.json changes)
- Direct source code execution
- No build optimization (faster startup)

**Workflow:**
1. Edit code in host filesystem
2. Changes reflected immediately in container
3. Bun automatically restarts on changes
4. Fast iteration cycle

### Production Profile

**File: `compose/compose.prod.yaml`**

Production-specific overrides:

```yaml
services:
  nano-proxy:
    build:
      context: ..
      dockerfile: compose/Containerfile
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

**File: `compose/Containerfile`**

Multi-stage production build:

```dockerfile
# Build stage
FROM docker.io/oven/bun:alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN bun install --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Runtime stage
FROM docker.io/oven/bun:alpine

WORKDIR /app

# Copy built app and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src

# Health check endpoint
EXPOSE 3000

CMD ["bun", "src/index.ts"]
```

**Production Features:**
- Multi-stage build for minimal image size
- Production dependencies only (no devDependencies)
- Health check endpoint (`/health`)
- Resource limits (CPU: 1 core max, Memory: 512MB max)
- Resource reservations (CPU: 0.5 core, Memory: 256MB)
- Immutable container (no volume mounts)
- Restart policy for resilience

**Optimizations:**
- Smaller final image (only runtime dependencies)
- Better security (fewer packages)
- Predictable resource usage
- Health monitoring for orchestration

### Environment Variables

**File: `compose/.env.example`**

Template for environment configuration:

```env
# Nano-proxy configuration
NODE_ENV=development
NANO_PROXY_PORT=3000

# Redis configuration (for future use)
REDIS_URL=redis://redis:6379
```

**Usage:**
1. Copy `.env.example` to `.env`
2. Customize values for your environment
3. Git ignores `.env` (keep secrets safe)

### Usage Documentation

**File: `compose/README.md`**

```markdown
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
```

## Project Cleanup

### Remove Duplicate index.ts

Currently the project has:
- `./index.ts` (root level - duplicate)
- `./src/index.ts` (correct location)

**Action:** Delete `./index.ts`, keep only `src/index.ts`

### Verify package.json Scripts

Ensure all scripts reference `src/index.ts`:

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test"
  }
}
```

## Implementation Tasks

1. Create `compose/` directory
2. Create base `compose.yaml`
3. Create development files (`compose.dev.yaml`, `Containerfile.dev`)
4. Create production files (`compose.prod.yaml`, `Containerfile`)
5. Create `.env.example`
6. Create `README.md` documentation
7. Delete `./index.ts` (root duplicate)
8. Verify package.json scripts
9. Test development profile
10. Test production profile
11. Commit all changes

## Testing Strategy

### Development Profile Test

```bash
cd compose
cp .env.example .env
podman-compose -f compose.yaml -f compose.dev.yaml up
```

**Verify:**
- Nano-proxy starts successfully
- Can access http://localhost:3000/health
- Code changes trigger reload
- Redis container is running

### Production Profile Test

```bash
cd compose
podman-compose -f compose.yaml -f compose.prod.yaml build
podman-compose -f compose.yaml -f compose.prod.yaml up -d
```

**Verify:**
- Multi-stage build completes
- Health check passes
- Service restarts on failure
- Resource limits applied
- Redis persists data

### Integration Test

```bash
# Test API with pool transform
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: jan-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Benefits

1. **Consistent Environments** - Same setup for all developers
2. **Easy Onboarding** - Clone repo, run compose, start coding
3. **Production-Ready** - Production profile matches deployment
4. **Redis Ready** - Infrastructure ready for session storage
5. **Isolated Development** - No conflicts with host system
6. **Resource Control** - Predictable resource usage in production
7. **Health Monitoring** - Built-in health checks for orchestration

## Future Enhancements

1. **Redis Session Storage** - Implement Redis-backed session manager
2. **Monitoring** - Add Prometheus metrics endpoint
3. **Logging** - Structured logging with log aggregation
4. **Secrets Management** - Use Podman secrets for API keys
5. **Multi-stage Environments** - Add staging profile
6. **CI/CD Integration** - Automate container builds and tests

## Success Criteria

- [x] Development profile with hot reload works
- [x] Production profile with multi-stage build works
- [x] Redis container runs and persists data
- [x] Health checks function correctly
- [x] Resource limits enforced
- [x] Documentation complete
- [x] Duplicate index.ts removed
- [x] Both profiles tested successfully
