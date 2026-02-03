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
