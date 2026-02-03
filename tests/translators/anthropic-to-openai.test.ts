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
