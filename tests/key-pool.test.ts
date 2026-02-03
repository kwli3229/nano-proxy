import { describe, test, expect } from "bun:test";
import { KeyPool } from "../src/key-pool";
import type { ProviderKey, PoolConfig } from "../src/types";

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
    const pool = new KeyPool({ "test": { keys: mockKeys, accepts: ["test"] } });

    const key1 = pool.selectKey("test");
    const key2 = pool.selectKey("test");
    const key3 = pool.selectKey("test");

    expect(key1.key).toBe("sk-ant-1");
    expect(key2.key).toBe("sk-ant-2");
    expect(key3.key).toBe("sk-ant-1"); // Wraps around
  });

  test("should throw error for unknown pool", () => {
    const pool = new KeyPool({ "test": { keys: mockKeys, accepts: ["test"] } });
    expect(() => pool.selectKey("unknown")).toThrow();
  });

  test("should return pool names", () => {
    const pool = new KeyPool({ "test": { keys: mockKeys, accepts: ["test"] } });
    expect(pool.getPoolNames()).toEqual(["test"]);
  });
});

describe("KeyPool - Client Key Mapping", () => {
  const mockPoolConfig: Record<string, PoolConfig> = {
    "jan": {
      accepts: ["jan-key-1", "jan-key-2"],
      keys: [
        {
          provider: "anthropic",
          key: "sk-ant-1",
          baseUrl: "https://api.anthropic.com",
          version: "2023-06-01",
          consoleUrl: "https://console.anthropic.com"
        }
      ],
      transform: {
        modelRemap: {
          "claude-opus-4-5": ["gpt-4"]
        }
      }
    },
    "default": {
      accepts: ["default-key"],
      keys: [
        {
          provider: "anthropic",
          key: "sk-ant-2",
          baseUrl: "https://api.anthropic.com",
          version: "2023-06-01",
          consoleUrl: "https://console.anthropic.com"
        }
      ]
    }
  };

  test("should map client key to pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const poolName1 = pool.getPoolNameByClientKey("jan-key-1");
    const poolName2 = pool.getPoolNameByClientKey("jan-key-2");
    const poolName3 = pool.getPoolNameByClientKey("default-key");

    expect(poolName1).toBe("jan");
    expect(poolName2).toBe("jan");
    expect(poolName3).toBe("default");
  });

  test("should return undefined for unknown client key", () => {
    const pool = new KeyPool(mockPoolConfig);

    const poolName = pool.getPoolNameByClientKey("unknown-key");

    expect(poolName).toBeUndefined();
  });

  test("should get pool transform by pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const transform = pool.getPoolTransform("jan");

    expect(transform?.modelRemap).toBeDefined();
    expect(transform?.modelRemap?.["claude-opus-4-5"]).toEqual(["gpt-4"]);
  });

  test("should return undefined transform for pool without transform", () => {
    const pool = new KeyPool(mockPoolConfig);

    const transform = pool.getPoolTransform("default");

    expect(transform).toBeUndefined();
  });

  test("should select key from correct pool using pool name", () => {
    const pool = new KeyPool(mockPoolConfig);

    const key = pool.selectKey("jan");

    expect(key.key).toBe("sk-ant-1");
  });
});
