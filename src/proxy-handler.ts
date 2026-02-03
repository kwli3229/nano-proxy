import { KeyPool } from "./key-pool";
import { SessionManager } from "./session-manager";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { detectFormat, Format } from "./format-detector";
import { translateRequest } from "./translators/openai-to-anthropic";
import { translateResponse } from "./translators/anthropic-to-openai";
import { translateError } from "./translators/error-translator";
import { transformAnthropicChunkToOpenAI, formatSSE, formatDoneSSE } from "./streaming/stream-transformer";
import { applyPoolTransform } from "./pool-transformer";

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
      // Get pool name from client API key
      const poolName = this.keyPool.getPoolNameByClientKey(request.userApiKey);

      if (!poolName) {
        // Fallback to proxy-default if it exists
        if (this.keyPool.hasPool("proxy-default")) {
          const fallbackPoolName = "proxy-default";

          // Detect format
          const format = detectFormat(request.path);
          if (format === Format.Unknown) {
            throw new Error("Unknown endpoint");
          }

          // Get provider key (with session stickiness if session ID provided)
          let providerKey;
          if (request.sessionId) {
            providerKey = this.sessionManager.get(request.sessionId, fallbackPoolName);
            if (!providerKey) {
              providerKey = this.keyPool.selectKey(fallbackPoolName);
              this.sessionManager.set(request.sessionId, fallbackPoolName, providerKey);
            }
          } else {
            providerKey = this.keyPool.selectKey(fallbackPoolName);
          }

          // Translate request if OpenAI format
          let anthropicRequest = request.body;
          let originalModel = request.body.model;

          if (format === Format.OpenAI) {
            anthropicRequest = translateRequest(request.body);
          }

          // No transforms for fallback pool
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
        } else {
          throw new Error("Invalid API key");
        }
      }

      // Detect format
      const format = detectFormat(request.path);
      if (format === Format.Unknown) {
        throw new Error("Unknown endpoint");
      }

      // Get provider key (with session stickiness if session ID provided)
      let providerKey;
      if (request.sessionId) {
        providerKey = this.sessionManager.get(request.sessionId, poolName);
        if (!providerKey) {
          providerKey = this.keyPool.selectKey(poolName);
          this.sessionManager.set(request.sessionId, poolName, providerKey);
        }
      } else {
        providerKey = this.keyPool.selectKey(poolName);
      }

      // Translate request if OpenAI format
      let anthropicRequest = request.body;
      let originalModel = request.body.model;

      if (format === Format.OpenAI) {
        anthropicRequest = translateRequest(request.body);
      }

      // Apply pool transforms (model remap + parameter overrides)
      const poolTransform = this.keyPool.getPoolTransform(poolName);
      if (poolTransform) {
        applyPoolTransform(anthropicRequest, poolTransform);
      }

      // Apply streaming control
      const streamingAllowed = this.keyPool.isStreamingAllowed(poolName);
      if (!streamingAllowed && anthropicRequest.stream) {
        anthropicRequest.stream = false;
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
