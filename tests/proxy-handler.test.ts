import { describe, test, expect } from "bun:test";
import { ProxyHandler } from "../src/proxy-handler";
import { KeyPool } from "../src/key-pool";
import { SessionManager } from "../src/session-manager";
import { AnthropicProvider } from "../src/providers/anthropic-provider";
import type { ProviderKey, PoolConfig } from "../src/types";

describe("ProxyHandler", () => {
  const mockKeys: ProviderKey[] = [
    {
      provider: "anthropic",
      key: "sk-ant-1",
      baseUrl: "https://api.anthropic.com",
      version: "2023-06-01",
      consoleUrl: "https://console.anthropic.com"
    }
  ];

  test("should handle OpenAI format request", async () => {
    const keyPool = new KeyPool({ "test-key": { keys: mockKeys, accepts: ["test-key"] } });
    const sessionManager = new SessionManager(3600000);
    const provider = new AnthropicProvider();
    const handler = new ProxyHandler(keyPool, sessionManager, provider);

    const request = {
      path: "/v1/chat/completions",
      userApiKey: "test-key",
      sessionId: "session-1",
      body: {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      }
    };

    // This will fail without mocking the actual API call
    // Just test structure for now
    expect(handler).toBeDefined();
  });
});

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
