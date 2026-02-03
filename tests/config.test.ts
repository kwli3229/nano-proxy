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
