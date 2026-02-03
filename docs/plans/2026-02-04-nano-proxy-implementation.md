Nano-Proxy Implementation Plan

  For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

  Goal: Build a lightweight API proxy that translates between OpenAI and Anthropic formats with session-based
  API key rotation.

  Architecture: Express.js server with format detection, bidirectional translation, streaming support, and
  in-memory session management for key pool rotation.

  Tech Stack: Bun runtime, Express.js, @anthropic-ai/sdk, TypeScript

  ---
  Task 1: Project Setup

  Files:
  - Create: package.json
  - Create: tsconfig.json
  - Create: .gitignore
  - Create: config/keys.example.json

  Step 1: Initialize Bun project

  Run: bun init -y

  Step 2: Create package.json

  {
    "name": "nano-proxy",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "bun --watch src/index.ts",
      "start": "bun src/index.ts",
      "test": "bun test"
    },
    "dependencies": {
      "express": "^4.18.2",
      "@anthropic-ai/sdk": "^0.20.0"
    },
    "devDependencies": {
      "@types/express": "^4.17.21",
      "bun-types": "latest"
    }
  }

  Step 3: Create tsconfig.json

  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ES2022",
      "lib": ["ES2022"],
      "moduleResolution": "bundler",
      "types": ["bun-types"],
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "outDir": "./dist",
      "rootDir": "./src"
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
  }

  Step 4: Create .gitignore

  node_modules/
  dist/
  .env
  config/keys.json
  *.log

  Step 5: Create config/keys.example.json

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
        }
      ]
    }
  }

  Step 6: Install dependencies

  Run: bun install
  Expected: Dependencies installed successfully

  Step 7: Create directory structure

  Run: mkdir -p src/{providers,translators,streaming} tests config

  Step 8: Commit

  git add .
  git commit -m "chore: initialize project with Bun, Express, and TypeScript"

  ---
  Task 2: Configuration Module

  Files:
  - Create: src/types.ts
  - Create: src/config.ts
  - Create: tests/config.test.ts

  Step 1: Write types definition

  Create src/types.ts:

  export interface ProviderKey {
    provider: string;
    key: string;
    baseUrl: string;
    version?: string;
    consoleUrl: string;
    model?: string;
    projectId?: string;
    location?: string;
    serviceAccountPath?: string;
  }

  export interface Config {
    port: number;
    sessionTimeout: number;
    apiKeyPools: Record<string, ProviderKey[]>;
  }

  Step 2: Write failing test

  Create tests/config.test.ts:

  import { describe, test, expect } from "bun:test";
  import { loadConfig } from "../src/config";

  describe("Config", () => {
    test("should load configuration from file", () => {
      const config = loadConfig("./config/keys.example.json");
      expect(config.port).toBe(3000);
      expect(config.apiKeyPools["proxy-default"]).toBeDefined();
    });

    test("should throw error for missing file", () => {
      expect(() => loadConfig("./nonexistent.json")).toThrow();
    });
  });

  Step 3: Run test to verify it fails

  Run: bun test tests/config.test.ts
  Expected: FAIL with "loadConfig is not defined"

  Step 4: Write minimal implementation

  Create src/config.ts:

  import { readFileSync } from "fs";
  import type { Config } from "./types";

  export function loadConfig(path: string): Config {
    try {
      const content = readFileSync(path, "utf-8");
      const config = JSON.parse(content) as Config;

      // Validate required fields
      if (!config.port || !config.apiKeyPools) {
        throw new Error("Invalid configuration: missing required fields");
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load config from ${path}: ${error}`);
    }
  }

  Step 5: Run test to verify it passes

  Run: bun test tests/config.test.ts
  Expected: PASS

  Step 6: Commit

  git add src/types.ts src/config.ts tests/config.test.ts
  git commit -m "feat: add configuration loading module"

  ---
  Task 3: Key Pool Manager

  Files:
  - Create: src/key-pool.ts
  - Create: tests/key-pool.test.ts

  Step 1: Write failing test

  Create tests/key-pool.test.ts:

  import { describe, test, expect } from "bun:test";
  import { KeyPool } from "../src/key-pool";
  import type { ProviderKey } from "../src/types";

  describe("KeyPool", () => {
    const mockKeys: ProviderKey[] = [
      {
        provider: "anthropic",
        key: "sk-ant-1",
        baseUrl: "https://api.anthropic.com",
        version: "2023-06-01",
        consoleUrl: "https://console.anthropic.com"
      },
      {
        provider: "anthropic",
        key: "sk-ant-2",
        baseUrl: "https://api.anthropic.com",
        version: "2023-06-01",
        consoleUrl: "https://console.anthropic.com"
      }
    ];

    test("should select keys in round-robin fashion", () => {
      const pool = new KeyPool({ "test": mockKeys });

      const key1 = pool.selectKey("test");
      const key2 = pool.selectKey("test");
      const key3 = pool.selectKey("test");

      expect(key1.key).toBe("sk-ant-1");
      expect(key2.key).toBe("sk-ant-2");
      expect(key3.key).toBe("sk-ant-1"); // Wraps around
    });

    test("should throw error for unknown pool", () => {
      const pool = new KeyPool({ "test": mockKeys });
      expect(() => pool.selectKey("unknown")).toThrow();
    });

    test("should return pool names", () => {
      const pool = new KeyPool({ "test": mockKeys });
      expect(pool.getPoolNames()).toEqual(["test"]);
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/key-pool.test.ts
  Expected: FAIL with "KeyPool is not defined"

  Step 3: Write minimal implementation

  Create src/key-pool.ts:

  import type { ProviderKey } from "./types";

  export class KeyPool {
    private pools: Record<string, ProviderKey[]>;
    private indices: Record<string, number> = {};

    constructor(pools: Record<string, ProviderKey[]>) {
      this.pools = pools;

      // Initialize indices for each pool
      for (const poolName in pools) {
        this.indices[poolName] = 0;
      }
    }

    selectKey(userApiKey: string): ProviderKey {
      const pool = this.pools[userApiKey];

      if (!pool || pool.length === 0) {
        throw new Error(`No keys available for pool: ${userApiKey}`);
      }

      // Get current index and increment (round-robin)
      const index = this.indices[userApiKey];
      this.indices[userApiKey] = (index + 1) % pool.length;

      return pool[index];
    }

    getPoolNames(): string[] {
      return Object.keys(this.pools);
    }

    hasPool(userApiKey: string): boolean {
      return userApiKey in this.pools;
    }
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/key-pool.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/key-pool.ts tests/key-pool.test.ts
  git commit -m "feat: add key pool manager with round-robin selection"

  ---
  Task 4: Session Manager

  Files:
  - Create: src/session-manager.ts
  - Create: tests/session-manager.test.ts

  Step 1: Write failing test

  Create tests/session-manager.test.ts:

  import { describe, test, expect } from "bun:test";
  import { SessionManager } from "../src/session-manager";
  import type { ProviderKey } from "../src/types";

  describe("SessionManager", () => {
    const mockKey: ProviderKey = {
      provider: "anthropic",
      key: "sk-ant-1",
      baseUrl: "https://api.anthropic.com",
      version: "2023-06-01",
      consoleUrl: "https://console.anthropic.com"
    };

    test("should store and retrieve session keys", () => {
      const manager = new SessionManager(3600000);

      manager.set("session-1", "user-key-1", mockKey);
      const retrieved = manager.get("session-1", "user-key-1");

      expect(retrieved).toEqual(mockKey);
    });

    test("should return undefined for non-existent session", () => {
      const manager = new SessionManager(3600000);
      const retrieved = manager.get("session-1", "user-key-1");

      expect(retrieved).toBeUndefined();
    });

    test("should expire sessions after timeout", async () => {
      const manager = new SessionManager(100); // 100ms timeout

      manager.set("session-1", "user-key-1", mockKey);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      manager.cleanup();

      const retrieved = manager.get("session-1", "user-key-1");
      expect(retrieved).toBeUndefined();
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/session-manager.test.ts
  Expected: FAIL with "SessionManager is not defined"

  Step 3: Write minimal implementation

  Create src/session-manager.ts:

  import type { ProviderKey } from "./types";

  interface SessionEntry {
    key: ProviderKey;
    expiresAt: number;
  }

  export class SessionManager {
    private sessions: Map<string, SessionEntry> = new Map();
    private timeout: number;
    private cleanupInterval: NodeJS.Timeout;

    constructor(timeout: number) {
      this.timeout = timeout;

      // Run cleanup every minute
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    set(sessionId: string, userApiKey: string, key: ProviderKey): void {
      const sessionKey = this.makeKey(sessionId, userApiKey);
      this.sessions.set(sessionKey, {
        key,
        expiresAt: Date.now() + this.timeout
      });
    }

    get(sessionId: string, userApiKey: string): ProviderKey | undefined {
      const sessionKey = this.makeKey(sessionId, userApiKey);
      const entry = this.sessions.get(sessionKey);

      if (!entry) {
        return undefined;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.sessions.delete(sessionKey);
        return undefined;
      }

      return entry.key;
    }

    cleanup(): void {
      const now = Date.now();
      for (const [key, entry] of this.sessions.entries()) {
        if (now > entry.expiresAt) {
          this.sessions.delete(key);
        }
      }
    }

    destroy(): void {
      clearInterval(this.cleanupInterval);
      this.sessions.clear();
    }

    private makeKey(sessionId: string, userApiKey: string): string {
      return `${sessionId}:${userApiKey}`;
    }
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/session-manager.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/session-manager.ts tests/session-manager.test.ts
  git commit -m "feat: add session manager with TTL expiration"

  ---
  Task 5: Format Detector

  Files:
  - Create: src/format-detector.ts
  - Create: tests/format-detector.test.ts

  Step 1: Write failing test

  Create tests/format-detector.test.ts:

  import { describe, test, expect } from "bun:test";
  import { detectFormat, Format } from "../src/format-detector";

  describe("FormatDetector", () => {
    test("should detect OpenAI format from path", () => {
      expect(detectFormat("/v1/chat/completions")).toBe(Format.OpenAI);
    });

    test("should detect Anthropic format from path", () => {
      expect(detectFormat("/v1/messages")).toBe(Format.Anthropic);
    });

    test("should return Unknown for invalid paths", () => {
      expect(detectFormat("/invalid/path")).toBe(Format.Unknown);
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/format-detector.test.ts
  Expected: FAIL with "detectFormat is not defined"

  Step 3: Write minimal implementation

  Create src/format-detector.ts:

  export enum Format {
    OpenAI = "openai",
    Anthropic = "anthropic",
    Unknown = "unknown"
  }

  export function detectFormat(path: string): Format {
    if (path === "/v1/chat/completions") {
      return Format.OpenAI;
    }

    if (path === "/v1/messages") {
      return Format.Anthropic;
    }

    return Format.Unknown;
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/format-detector.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/format-detector.ts tests/format-detector.test.ts
  git commit -m "feat: add format detection for OpenAI and Anthropic"

  ---
  Task 6: OpenAI to Anthropic Request Translator

  Files:
  - Create: src/translators/openai-to-anthropic.ts
  - Create: tests/translators/openai-to-anthropic.test.ts

  Step 1: Write failing test

  Create tests/translators/openai-to-anthropic.test.ts:

  import { describe, test, expect } from "bun:test";
  import { translateRequest } from "../../src/translators/openai-to-anthropic";

  describe("OpenAI to Anthropic Translator", () => {
    test("should translate basic OpenAI request", () => {
      const openaiRequest = {
        model: "gpt-4",
        messages: [
          { role: "user", content: "Hello" }
        ],
        max_tokens: 100,
        temperature: 0.7
      };

      const result = translateRequest(openaiRequest);

      expect(result.model).toBe("claude-opus-4-5");
      expect(result.messages).toEqual([{ role: "user", content: "Hello" }]);
      expect(result.max_tokens).toBe(100);
      expect(result.temperature).toBe(0.7);
    });

    test("should extract system message", () => {
      const openaiRequest = {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello" }
        ]
      };

      const result = translateRequest(openaiRequest);

      expect(result.system).toBe("You are helpful");
      expect(result.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    test("should map model names", () => {
      expect(translateRequest({ model: "gpt-4", messages: [] }).model).toBe("claude-opus-4-5");
      expect(translateRequest({ model: "gpt-3.5-turbo", messages: [] }).model).toBe("claude-sonnet-4-5");
    });

    test("should rename stop to stop_sequences", () => {
      const openaiRequest = {
        model: "gpt-4",
        messages: [],
        stop: ["END"]
      };

      const result = translateRequest(openaiRequest);
      expect(result.stop_sequences).toEqual(["END"]);
      expect(result.stop).toBeUndefined();
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/translators/openai-to-anthropic.test.ts
  Expected: FAIL with "translateRequest is not defined"

  Step 3: Write minimal implementation

  Create src/translators/openai-to-anthropic.ts:

  const MODEL_MAP: Record<string, string> = {
    "gpt-4": "claude-opus-4-5",
    "gpt-4-turbo": "claude-opus-4-5",
    "gpt-3.5-turbo": "claude-sonnet-4-5",
  };

  export function translateRequest(openaiRequest: any): any {
    const anthropicRequest: any = {
      model: MODEL_MAP[openaiRequest.model] || openaiRequest.model,
      messages: [],
    };

    // Extract system message if present
    const messages = openaiRequest.messages || [];
    if (messages.length > 0 && messages[0].role === "system") {
      anthropicRequest.system = messages[0].content;
      anthropicRequest.messages = messages.slice(1);
    } else {
      anthropicRequest.messages = messages;
    }

    // Direct mappings
    if (openaiRequest.max_tokens !== undefined) {
      anthropicRequest.max_tokens = openaiRequest.max_tokens;
    }
    if (openaiRequest.temperature !== undefined) {
      anthropicRequest.temperature = openaiRequest.temperature;
    }
    if (openaiRequest.top_p !== undefined) {
      anthropicRequest.top_p = openaiRequest.top_p;
    }
    if (openaiRequest.stream !== undefined) {
      anthropicRequest.stream = openaiRequest.stream;
    }

    // Rename stop to stop_sequences
    if (openaiRequest.stop !== undefined) {
      anthropicRequest.stop_sequences = Array.isArray(openaiRequest.stop)
        ? openaiRequest.stop
        : [openaiRequest.stop];
    }

    return anthropicRequest;
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/translators/openai-to-anthropic.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/translators/openai-to-anthropic.ts tests/translators/openai-to-anthropic.test.ts
  git commit -m "feat: add OpenAI to Anthropic request translator"

  ---
  Task 7: Anthropic to OpenAI Response Translator

  Files:
  - Create: src/translators/anthropic-to-openai.ts
  - Create: tests/translators/anthropic-to-openai.test.ts

  Step 1: Write failing test

  Create tests/translators/anthropic-to-openai.test.ts:

  import { describe, test, expect } from "bun:test";
  import { translateResponse } from "../../src/translators/anthropic-to-openai";

  describe("Anthropic to OpenAI Translator", () => {
    test("should translate basic Anthropic response", () => {
      const anthropicResponse = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello there!" }],
        model: "claude-opus-4-5",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      const result = translateResponse(anthropicResponse, "gpt-4");

      expect(result.id).toBe("msg_123");
      expect(result.object).toBe("chat.completion");
      expect(result.model).toBe("gpt-4");
      expect(result.choices[0].message.role).toBe("assistant");
      expect(result.choices[0].message.content).toBe("Hello there!");
      expect(result.choices[0].finish_reason).toBe("stop");
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(20);
      expect(result.usage.total_tokens).toBe(30);
    });

    test("should map stop reasons correctly", () => {
      const response = {
        id: "msg_123",
        content: [{ type: "text", text: "Hi" }],
        stop_reason: "max_tokens",
        usage: { input_tokens: 5, output_tokens: 10 }
      };

      const result = translateResponse(response, "gpt-4");
      expect(result.choices[0].finish_reason).toBe("length");
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/translators/anthropic-to-openai.test.ts
  Expected: FAIL with "translateResponse is not defined"

  Step 3: Write minimal implementation

  Create src/translators/anthropic-to-openai.ts:

  const STOP_REASON_MAP: Record<string, string> = {
    "end_turn": "stop",
    "max_tokens": "length",
    "stop_sequence": "stop",
  };

  export function translateResponse(anthropicResponse: any, requestedModel: string): any {
    const content = anthropicResponse.content?.[0]?.text || "";

    return {
      id: anthropicResponse.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: requestedModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content
          },
          finish_reason: STOP_REASON_MAP[anthropicResponse.stop_reason] || "stop"
        }
      ],
      usage: {
        prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
        completion_tokens: anthropicResponse.usage?.output_tokens || 0,
        total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens ||
   0)
      }
    };
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/translators/anthropic-to-openai.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/translators/anthropic-to-openai.ts tests/translators/anthropic-to-openai.test.ts
  git commit -m "feat: add Anthropic to OpenAI response translator"

  ---
  Task 8: Error Translator

  Files:
  - Create: src/translators/error-translator.ts
  - Create: tests/translators/error-translator.test.ts

  Step 1: Write failing test

  Create tests/translators/error-translator.test.ts:

  import { describe, test, expect } from "bun:test";
  import { translateError } from "../../src/translators/error-translator";

  describe("Error Translator", () => {
    test("should translate Anthropic error to OpenAI format", () => {
      const anthropicError = {
        type: "error",
        error: {
          type: "authentication_error",
          message: "Invalid API key"
        }
      };

      const result = translateError(anthropicError);

      expect(result.error.message).toBe("Invalid API key");
      expect(result.error.type).toBe("invalid_request_error");
      expect(result.error.code).toBe("invalid_api_key");
    });

    test("should map error types correctly", () => {
      const testCases = [
        { input: "rate_limit_error", expected: "rate_limit_exceeded" },
        { input: "overloaded_error", expected: "server_error" },
        { input: "permission_error", expected: "insufficient_quota" }
      ];

      for (const { input, expected } of testCases) {
        const error = {
          type: "error",
          error: { type: input, message: "Test" }
        };
        const result = translateError(error);
        expect(result.error.code).toBe(expected);
      }
    });

    test("should create OpenAI error from string message", () => {
      const result = translateError("Something went wrong", 500);

      expect(result.error.message).toBe("Something went wrong");
      expect(result.error.type).toBe("server_error");
      expect(result.error.code).toBe("server_error");
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/translators/error-translator.test.ts
  Expected: FAIL with "translateError is not defined"

  Step 3: Write minimal implementation

  Create src/translators/error-translator.ts:

  const ERROR_TYPE_MAP: Record<string, string> = {
    "invalid_request_error": "invalid_request_error",
    "authentication_error": "invalid_api_key",
    "permission_error": "insufficient_quota",
    "not_found_error": "model_not_found",
    "rate_limit_error": "rate_limit_exceeded",
    "api_error": "server_error",
    "overloaded_error": "server_error",
  };

  export function translateError(error: any, statusCode?: number): any {
    // Handle string errors
    if (typeof error === "string") {
      return {
        error: {
          message: error,
          type: "server_error",
          code: "server_error"
        }
      };
    }

    // Handle Anthropic error format
    if (error.type === "error" && error.error) {
      const anthropicError = error.error;
      return {
        error: {
          message: anthropicError.message,
          type: "invalid_request_error",
          code: ERROR_TYPE_MAP[anthropicError.type] || "server_error"
        }
      };
    }

    // Fallback
    return {
      error: {
        message: error.message || "Unknown error",
        type: "server_error",
        code: "server_error"
      }
    };
  }

  Step 4: Run test to verify it passes

  Run: bun test tests/translators/error-translator.test.ts
  Expected: PASS

  Step 5: Commit

  git add src/translators/error-translator.ts tests/translators/error-translator.test.ts
  git commit -m "feat: add error translator for Anthropic to OpenAI format"

  ---
  Task 9: Stream Transformer

  Files:
  - Create: src/streaming/stream-transformer.ts
  - Create: tests/streaming/stream-transformer.test.ts

  Step 1: Write failing test

  Create tests/streaming/stream-transformer.test.ts:

  import { describe, test, expect } from "bun:test";
  import { transformAnthropicChunkToOpenAI } from "../../src/streaming/stream-transformer";

  describe("Stream Transformer", () => {
    test("should transform message_start event", () => {
      const chunk = {
        type: "message_start",
        message: { id: "msg_123", model: "claude-opus-4-5" }
      };

      const result = transformAnthropicChunkToOpenAI(chunk, "gpt-4", "msg_123");

      expect(result.id).toBe("msg_123");
      expect(result.object).toBe("chat.completion.chunk");
      expect(result.model).toBe("gpt-4");
      expect(result.choices[0].delta).toEqual({});
    });

    test("should transform content_block_delta event", () => {
      const chunk = {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hello" }
      };

      const result = transformAnthropicChunkToOpenAI(chunk, "gpt-4", "msg_123");

      expect(result.choices[0].delta.content).toBe("Hello");
      expect(result.choices[0].finish_reason).toBeNull();
    });

    test("should transform message_stop event", () => {
      const chunk = {
        type: "message_delta",
        delta: { stop_reason: "end_turn" }
      };

      const result = transformAnthropicChunkToOpenAI(chunk, "gpt-4", "msg_123");

      expect(result.choices[0].delta).toEqual({});
      expect(result.choices[0].finish_reason).toBe("stop");
    });

    test("should format as SSE", () => {
      const chunk = {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hi" }
      };

      const result = transformAnthropicChunkToOpenAI(chunk, "gpt-4", "msg_123");
      const sse = `data: ${JSON.stringify(result)}\n\n`;

      expect(sse).toContain("data: {");
      expect(sse).toContain('"delta":{"content":"Hi"}');
    });
  });

  Step 2: Run test to verify it fails

  Run: bun test tests/streaming/stream-transformer.test.ts
  Expected: FAIL with "transformAnthropicChunkToOpenAI is not defined"

  Step 3: Write minimal implementation

  Create src/streaming/stream-transformer.ts:

  const STOP_REASON_MAP: Record<string, string> = {
    "end_turn": "stop",
    "max_tokens": "length",
    "stop_sequence": "stop",
  };

  export function transformAnthropicChunkToOpenAI(
    chunk: any,
    requestedModel: string,
    messageId: string
  ): any {
    const baseChunk = {
      id: messageId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: requestedModel,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null
        }
      ]
    };

    // Handle different event types
    if (chunk.type === "message_start") {
      return baseChunk;
    }

    if (chunk.type === "content_block_delta" && chunk.delta?.text) {
      baseChunk.choices[0].delta = { content: chunk.delta.text };
      return baseChunk;
    }

    if (chunk.type === "message_delta" && chunk.delta?.stop_reason) {
      baseChunk.choices[0].finish_reason = STOP_REASON_MAP[chunk.delta.stop_reason] || "stop";
      return baseChunk;
    }

    return baseChunk;
  }

  export function formatSSE(data: any): string {
    return `data: ${JSON.stringify(data)}\n\n`;
  }

  export function formatDoneSSE(): string {
    return "data: [DONE]\n\n";
  }

**Step 4: Run test to verify it passes**

Run: `bun test tests/streaming/stream-transformer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/streaming/stream-transformer.ts tests/streaming/stream-transformer.test.ts
git commit -m "feat: add streaming transformer for Anthropic to OpenAI SSE"
```

---

## Task 10: Anthropic Provider

**Files:**
- Create: `src/providers/base-provider.ts`
- Create: `src/providers/anthropic-provider.ts`
- Create: `tests/providers/anthropic-provider.test.ts`

**Step 1: Write base provider interface**

Create `src/providers/base-provider.ts`:

```typescript
import type { ProviderKey } from "../types";

export interface BaseProvider {
  makeRequest(request: any, providerKey: ProviderKey): Promise<any>;
  makeStreamingRequest(request: any, providerKey: ProviderKey): Promise<ReadableStream>;
}
```

**Step 2: Write failing test**

Create `tests/providers/anthropic-provider.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { AnthropicProvider } from "../../src/providers/anthropic-provider";
import type { ProviderKey } from "../../src/types";

describe("AnthropicProvider", () => {
  const mockKey: ProviderKey = {
    provider: "anthropic",
    key: "sk-ant-test",
    baseUrl: "https://api.anthropic.com",
    version: "2023-06-01",
    consoleUrl: "https://console.anthropic.com"
  };

  test("should create Anthropic client with correct config", () => {
    const provider = new AnthropicProvider();
    expect(provider).toBeDefined();
  });

  // Note: Full integration tests require real API or mocking
  // These are placeholder tests for structure
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/providers/anthropic-provider.test.ts`
Expected: FAIL with "AnthropicProvider is not defined"

**Step 4: Write minimal implementation**

Create `src/providers/anthropic-provider.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { BaseProvider } from "./base-provider";
import type { ProviderKey } from "../types";

export class AnthropicProvider implements BaseProvider {
  async makeRequest(request: any, providerKey: ProviderKey): Promise<any> {
    const client = new Anthropic({
      apiKey: providerKey.key,
      baseURL: providerKey.baseUrl,
    });

    const response = await client.messages.create({
      ...request,
      model: request.model,
      max_tokens: request.max_tokens || 1024,
    });

    return response;
  }

  async makeStreamingRequest(request: any, providerKey: ProviderKey): Promise<ReadableStream> {
    const client = new Anthropic({
      apiKey: providerKey.key,
      baseURL: providerKey.baseUrl,
    });

    const stream = await client.messages.create({
      ...request,
      model: request.model,
      max_tokens: request.max_tokens || 1024,
      stream: true,
    });

    // Convert Anthropic stream to web ReadableStream
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/providers/anthropic-provider.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/providers/base-provider.ts src/providers/anthropic-provider.ts tests/providers/anthropic-provider.test.ts
git commit -m "feat: add Anthropic provider with streaming support"
```

---

## Task 11: Proxy Handler

**Files:**
- Create: `src/proxy-handler.ts`
- Create: `tests/proxy-handler.test.ts`

**Step 1: Write failing test**

Create `tests/proxy-handler.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { ProxyHandler } from "../src/proxy-handler";
import { KeyPool } from "../src/key-pool";
import { SessionManager } from "../src/session-manager";
import { AnthropicProvider } from "../src/providers/anthropic-provider";
import type { ProviderKey } from "../src/types";

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
    const keyPool = new KeyPool({ "test-key": mockKeys });
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/proxy-handler.test.ts`
Expected: FAIL with "ProxyHandler is not defined"

**Step 3: Write minimal implementation**

Create `src/proxy-handler.ts`:

```typescript
import { KeyPool } from "./key-pool";
import { SessionManager } from "./session-manager";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { detectFormat, Format } from "./format-detector";
import { translateRequest } from "./translators/openai-to-anthropic";
import { translateResponse } from "./translators/anthropic-to-openai";
import { translateError } from "./translators/error-translator";
import { transformAnthropicChunkToOpenAI, formatSSE, formatDoneSSE } from "./streaming/stream-transformer";

interface ProxyRequest {
  path: string;
  userApiKey: string;
  sessionId?: string;
  body: any;
}

export class ProxyHandler {
  constructor(
    private keyPool: KeyPool,
    private sessionManager: SessionManager,
    private provider: AnthropicProvider
  ) {}

  async handleRequest(request: ProxyRequest): Promise<any> {
    try {
      // Validate user API key
      if (!this.keyPool.hasPool(request.userApiKey)) {
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
        providerKey = this.sessionManager.get(request.sessionId, request.userApiKey);
        if (!providerKey) {
          providerKey = this.keyPool.selectKey(request.userApiKey);
          this.sessionManager.set(request.sessionId, request.userApiKey, providerKey);
        }
      } else {
        providerKey = this.keyPool.selectKey(request.userApiKey);
      }

      // Translate request if OpenAI format
      let anthropicRequest = request.body;
      let originalModel = request.body.model;

      if (format === Format.OpenAI) {
        anthropicRequest = translateRequest(request.body);
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

  async handleStreamingRequest(
    anthropicRequest: any,
    providerKey: any,
    format: Format,
    originalModel: string
  ): Promise<ReadableStream> {
    const stream = await this.provider.makeStreamingRequest(anthropicRequest, providerKey);

    if (format === Format.Anthropic) {
      // Pass through for Anthropic format
      return stream;
    }

    // Transform for OpenAI format
    const messageId = `chatcmpl-${Date.now()}`;

    return new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue(encoder.encode(formatDoneSSE()));
              break;
            }

            // Transform chunk
            const openaiChunk = transformAnthropicChunkToOpenAI(value, originalModel, messageId);
            controller.enqueue(encoder.encode(formatSSE(openaiChunk)));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/proxy-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/proxy-handler.ts tests/proxy-handler.test.ts
git commit -m "feat: add proxy handler with format translation and streaming"
```

---

## Task 12: Express Server

**Files:**
- Create: `src/index.ts`

**Step 1: Write Express server**

Create `src/index.ts`:

```typescript
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
```

**Step 2: Test server startup**

Run: `bun --watch src/index.ts`
Expected: Server starts without errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Express server with OpenAI and Anthropic endpoints"
```

---

## Task 13: Create Example Configuration

**Files:**
- Create: `config/keys.json` (from example)

**Step 1: Copy example config**

Run: `cp config/keys.example.json config/keys.json`

**Step 2: Edit with real API keys**

Edit `config/keys.json` and add your real Anthropic API keys.

**Step 3: Test configuration loading**

Run: `bun src/index.ts`
Expected: Server starts and loads configuration successfully

---

## Task 14: Integration Testing

**Files:**
- Create: `tests/integration.test.ts`

**Step 1: Write integration test**

Create `tests/integration.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("Integration Tests", () => {
  let serverUrl = "http://localhost:3000";

  test("health check should return ok", async () => {
    const response = await fetch(`${serverUrl}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  test("should reject request without auth header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect(response.status).toBe(401);
  });

  // Add more integration tests as needed
});
```

**Step 2: Run integration tests**

Run: `bun test tests/integration.test.ts`
Expected: Tests pass (requires server running)

**Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add integration tests for API endpoints"
```

---

## Task 15: Documentation

**Files:**
- Create: `README.md`

**Step 1: Write README**

Create `README.md`:

```markdown
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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

## Success Criteria

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Server starts without errors
- [ ] OpenAI format requests work correctly
- [ ] Anthropic format requests work correctly
- [ ] Streaming works for both formats
- [ ] Session-based key rotation works
- [ ] Error translation works correctly
- [ ] Documentation is complete

## Next Steps

After completing this plan:

1. Manual testing with real API keys
2. Test with actual OpenAI clients (Cursor, ChatGPT, etc.)
3. Performance testing
4. Add Google AI provider support (v2)
5. Add Redis session storage (v2)
