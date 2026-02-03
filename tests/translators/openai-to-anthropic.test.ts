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

    // Model is passed through as-is; pool transform will handle remapping
    expect(result.model).toBe("gpt-4");
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

  test("should pass through model names without remapping", () => {
    // Model remapping is now handled at pool level, not in translator
    expect(translateRequest({ model: "gpt-4", messages: [] }).model).toBe("gpt-4");
    expect(translateRequest({ model: "gpt-3.5-turbo", messages: [] }).model).toBe("gpt-3.5-turbo");
    expect(translateRequest({ model: "claude-opus-4-5", messages: [] }).model).toBe("claude-opus-4-5");
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
