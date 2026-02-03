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
