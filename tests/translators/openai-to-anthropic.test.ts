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
