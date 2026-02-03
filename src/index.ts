import express from "express";
import { loadConfig } from "./config";
import { KeyPool } from "./key-pool";
import { SessionManager } from "./session-manager";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { ProxyHandler } from "./proxy-handler";

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, User-Agent, anthropic-version, anthropic-dangerous-direct-browser-access, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Load configuration
const config = loadConfig("./config/keys.json");

// Override with environment variables if provided
const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.port;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize components
const keyPool = new KeyPool(config.apiKeyPools);
const sessionManager = new SessionManager(config.sessionTimeout);
const provider = new AnthropicProvider();
const proxyHandler = new ProxyHandler(keyPool, sessionManager, provider);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Models endpoint for OpenAI compatibility
app.get("/v1/models", (req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: "claude-opus-4-5",
        object: "model",
        created: 1687882411,
        owned_by: "anthropic",
        permission: [],
        root: "claude-opus-4-5",
        parent: null
      },
      {
        id: "claude-sonnet-4-5",
        object: "model",
        created: 1677610602,
        owned_by: "anthropic",
        permission: [],
        root: "claude-sonnet-4-5",
        parent: null
      },
      {
        id: "gpt-4",
        object: "model",
        created: 1687882411,
        owned_by: "openai",
        permission: [],
        root: "gpt-4",
        parent: null
      },
      {
        id: "gpt-3.5-turbo",
        object: "model",
        created: 1677610602,
        owned_by: "openai",
        permission: [],
        root: "gpt-3.5-turbo",
        parent: null
      }
    ]
  });
});

// OpenAI endpoint (with /v1 prefix)
app.post("/v1/chat/completions", async (req, res) => {
  try {
    // Accept either Authorization header or x-api-key header
    const authHeader = req.headers.authorization;
    const apiKey = req.headers["x-api-key"] as string;

    let userApiKey: string;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      userApiKey = authHeader.substring(7);
    } else if (apiKey) {
      userApiKey = apiKey;
    } else {
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

    // Check if streaming
    if (result instanceof ReadableStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = result.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }

      res.end();
    } else {
      res.json(result);
    }
  } catch (error: any) {
    console.error("Error handling request:", error);
    res.status(500).json({
      error: {
        message: error.message || "Internal server error",
        type: "server_error",
        code: "server_error"
      }
    });
  }
});

// Anthropic endpoint
app.post("/v1/messages", async (req, res) => {
  try {
    // Accept either Authorization header or x-api-key header
    const authHeader = req.headers.authorization;
    const apiKey = req.headers["x-api-key"] as string;

    let userApiKey: string;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      userApiKey = authHeader.substring(7);
    } else if (apiKey) {
      userApiKey = apiKey;
    } else {
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

    // Check if streaming
    if (result instanceof ReadableStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = result.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }

      res.end();
    } else {
      res.json(result);
    }
  } catch (error: any) {
    console.error("Error handling request:", error);
    res.status(500).json({
      type: "error",
      error: {
        type: "api_error",
        message: error.message || "Internal server error"
      }
    });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Nano-proxy listening on ${HOST}:${PORT}`);
  console.log(`Available API key pools: ${keyPool.getPoolNames().join(", ")}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  sessionManager.destroy();
  process.exit(0);
});
