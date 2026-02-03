import { describe, test, expect } from "bun:test";
import { applyModelRemap, applyParameterOverrides, applyPoolTransform } from "../src/pool-transformer";
import type { PoolTransform } from "../src/types";

describe("Pool Transformer", () => {
  describe("applyModelRemap", () => {
    test("should remap client model to anthropic model", () => {
      const request = { model: "gpt-4", messages: [] };
      const modelRemap = {
        "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"],
        "claude-sonnet-4-5": ["gpt-3.5-turbo"]
      };

      applyModelRemap(request, modelRemap);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should not change model if not in remap", () => {
      const request = { model: "claude-opus-4-5", messages: [] };
      const modelRemap = {
        "claude-sonnet-4-5": ["gpt-3.5-turbo"]
      };

      applyModelRemap(request, modelRemap);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should handle multiple client models mapping to same anthropic model", () => {
      const request1 = { model: "gpt-4", messages: [] };
      const request2 = { model: "gpt-4-turbo", messages: [] };
      const modelRemap = {
        "claude-opus-4-5": ["gpt-4", "gpt-4-turbo"]
      };

      applyModelRemap(request1, modelRemap);
      applyModelRemap(request2, modelRemap);

      expect(request1.model).toBe("claude-opus-4-5");
      expect(request2.model).toBe("claude-opus-4-5");
    });

    test("should do nothing if no modelRemap provided", () => {
      const request = { model: "gpt-4", messages: [] };

      applyModelRemap(request, undefined);

      expect(request.model).toBe("gpt-4");
    });
  });

  describe("applyParameterOverrides", () => {
    test("should override max_tokens", () => {
      const request = { model: "claude", messages: [], max_tokens: 4096 };
      const overrides = { max_tokens: 2048 };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(2048);
    });

    test("should add parameter if not present", () => {
      const request: any = { model: "claude", messages: [] };
      const overrides = { temperature: 0.7, max_tokens: 1024 };

      applyParameterOverrides(request, overrides);

      expect(request.temperature).toBe(0.7);
      expect(request.max_tokens).toBe(1024);
    });

    test("should override multiple parameters", () => {
      const request: any = {
        model: "claude",
        messages: [],
        max_tokens: 4096,
        temperature: 1.0,
        top_p: 0.5
      };
      const overrides = {
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9
      };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(1024);
      expect(request.temperature).toBe(0.7);
      expect(request.top_p).toBe(0.9);
    });

    test("should not touch parameters not in overrides", () => {
      const request: any = {
        model: "claude",
        messages: [],
        max_tokens: 4096,
        temperature: 1.0,
        top_k: 50
      };
      const overrides = { max_tokens: 1024 };

      applyParameterOverrides(request, overrides);

      expect(request.max_tokens).toBe(1024);
      expect(request.temperature).toBe(1.0);  // Unchanged
      expect(request.top_k).toBe(50);  // Unchanged
    });

    test("should override stop_sequences array", () => {
      const request: any = {
        model: "claude",
        messages: [],
        stop_sequences: ["STOP"]
      };
      const overrides = { stop_sequences: ["END", "DONE"] };

      applyParameterOverrides(request, overrides);

      expect(request.stop_sequences).toEqual(["END", "DONE"]);
    });

    test("should do nothing if no overrides provided", () => {
      const request: any = { model: "claude", messages: [], max_tokens: 4096 };

      applyParameterOverrides(request, undefined);

      expect(request.max_tokens).toBe(4096);
    });
  });

  describe("applyPoolTransform", () => {
    test("should apply both model remap and parameter overrides", () => {
      const request: any = {
        model: "gpt-4",
        messages: [],
        max_tokens: 4096
      };
      const transform: PoolTransform = {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        },
        parameterOverrides: {
          max_tokens: 2048,
          temperature: 0.7
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude-opus-4-5");
      expect(request.max_tokens).toBe(2048);
      expect(request.temperature).toBe(0.7);
    });

    test("should apply only model remap if no overrides", () => {
      const request: any = { model: "gpt-4", messages: [] };
      const transform: PoolTransform = {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude-opus-4-5");
    });

    test("should apply only overrides if no model remap", () => {
      const request: any = { model: "claude", messages: [] };
      const transform: PoolTransform = {
        parameterOverrides: {
          max_tokens: 2048
        }
      };

      applyPoolTransform(request, transform);

      expect(request.model).toBe("claude");
      expect(request.max_tokens).toBe(2048);
    });

    test("should do nothing if no transform provided", () => {
      const request: any = { model: "gpt-4", messages: [], max_tokens: 4096 };

      applyPoolTransform(request, undefined);

      expect(request.model).toBe("gpt-4");
      expect(request.max_tokens).toBe(4096);
    });
  });
});
