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

describe("Config - Pool Transform Support", () => {
  test("should load new pool config format with transform", () => {
    // Create a temp config file
    const configContent = {
      port: 3000,
      sessionTimeout: 3600000,
      apiKeyPools: {
        "jan": {
          accepts: ["jan-key"],
          keys: [
            {
              provider: "anthropic",
              key: "sk-ant-xxx",
              baseUrl: "https://api.anthropic.com",
              version: "2023-06-01",
              consoleUrl: "https://console.anthropic.com"
            }
          ],
          transform: {
            modelRemap: {
              "claude-opus-4-5": ["gpt-4"]
            },
            parameterOverrides: {
              max_tokens: 2048
            }
          }
        }
      }
    };

    const tempPath = "/tmp/test-config-new.json";
    Bun.write(tempPath, JSON.stringify(configContent));

    const config = loadConfig(tempPath);

    expect(config.apiKeyPools["jan"].accepts).toEqual(["jan-key"]);
    expect(config.apiKeyPools["jan"].keys).toBeDefined();
    expect(config.apiKeyPools["jan"].transform?.modelRemap).toBeDefined();
  });

  test("should normalize old format to new format", () => {
    const configContent = {
      port: 3000,
      sessionTimeout: 3600000,
      apiKeyPools: {
        "old-pool": [
          {
            provider: "anthropic",
            key: "sk-ant-xxx",
            baseUrl: "https://api.anthropic.com",
            version: "2023-06-01",
            consoleUrl: "https://console.anthropic.com"
          }
        ]
      }
    };

    const tempPath = "/tmp/test-config-old.json";
    Bun.write(tempPath, JSON.stringify(configContent));

    const config = loadConfig(tempPath);

    // Should be normalized
    expect(config.apiKeyPools["old-pool"].accepts).toEqual(["old-pool"]);
    expect(config.apiKeyPools["old-pool"].keys).toBeDefined();
    expect(config.apiKeyPools["old-pool"].transform).toBeUndefined();
  });
});
