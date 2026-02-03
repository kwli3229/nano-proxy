import { describe, test, expect } from "bun:test";
import { KeyPool } from "../src/key-pool";
import type { ProviderKey } from "../src/types";

describe("KeyPool", () => {
  const mockKeys: ProviderKey[] = [
    {
      provider: "anthropic",
      key: "sk-ant-1",
      baseUrl: "https://api.anthropic.com",
      version: "2023-06-01",
      consoleUrl: "https://console.anthropic.com"
    },
    {
      provider: "anthropic",
      key: "sk-ant-2",
      baseUrl: "https://api.anthropic.com",
      version: "2023-06-01",
      consoleUrl: "https://console.anthropic.com"
    }
  ];

  test("should select keys in round-robin fashion", () => {
    const pool = new KeyPool({ "test": mockKeys });

    const key1 = pool.selectKey("test");
    const key2 = pool.selectKey("test");
    const key3 = pool.selectKey("test");

    expect(key1.key).toBe("sk-ant-1");
    expect(key2.key).toBe("sk-ant-2");
    expect(key3.key).toBe("sk-ant-1"); // Wraps around
  });

  test("should throw error for unknown pool", () => {
    const pool = new KeyPool({ "test": mockKeys });
    expect(() => pool.selectKey("unknown")).toThrow();
  });

  test("should return pool names", () => {
    const pool = new KeyPool({ "test": mockKeys });
    expect(pool.getPoolNames()).toEqual(["test"]);
  });
});
