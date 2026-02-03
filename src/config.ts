import { readFileSync } from "fs";
import type { Config } from "./types";

export function loadConfig(path: string): Config {
  try {
    const content = readFileSync(path, "utf-8");
    const config = JSON.parse(content) as Config;

    // Validate required fields
    if (!config.port || !config.apiKeyPools) {
      throw new Error("Invalid configuration: missing required fields");
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to load config from ${path}: ${error}`);
  }
}
