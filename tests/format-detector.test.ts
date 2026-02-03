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
