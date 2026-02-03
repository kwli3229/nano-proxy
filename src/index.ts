import express from "express";
import { loadConfig } from "./config";
import { KeyPool } from "./key-pool";
import { SessionManager } from "./session-manager";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { ProxyHandler } from "./proxy-handler";

const app = express();
app.use(express.json());

// Load configuration
const config = loadConfig("./config/keys.json");

// Initialize components
const keyPool = new KeyPool(config.apiKeyPools);
const sessionManager = new SessionManager(config.sessionTimeout);
const provider = new AnthropicProvider();
const proxyHandler = new ProxyHandler(keyPool, sessionManager, provider);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// OpenAI endpoint
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          message: "Missing or invalid authorization header",
          type: "invalid_request_error",
          code: "invalid_api_key"
        }
      });
    }

    const userApiKey = authHeader.substring(7);
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message: "Missing or invalid authorization header"
        }
      });
    }

    const userApiKey = authHeader.substring(7);
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
app.listen(config.port, () => {
  console.log(`Nano-proxy listening on port ${config.port}`);
  console.log(`Available API key pools: ${keyPool.getPoolNames().join(", ")}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  sessionManager.destroy();
  process.exit(0);
});
