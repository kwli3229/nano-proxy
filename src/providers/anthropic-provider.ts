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
