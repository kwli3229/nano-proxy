import { describe, test, expect } from "bun:test";
import { SessionManager } from "../src/session-manager";
import type { ProviderKey } from "../src/types";

describe("SessionManager", () => {
  const mockKey: ProviderKey = {
    provider: "anthropic",
    key: "sk-ant-1",
    baseUrl: "https://api.anthropic.com",
    version: "2023-06-01",
    consoleUrl: "https://console.anthropic.com"
  };

  test("should store and retrieve session keys", () => {
    const manager = new SessionManager(3600000);

    manager.set("session-1", "user-key-1", mockKey);
    const retrieved = manager.get("session-1", "user-key-1");

    expect(retrieved).toEqual(mockKey);
  });

  test("should return undefined for non-existent session", () => {
    const manager = new SessionManager(3600000);
    const retrieved = manager.get("session-1", "user-key-1");

    expect(retrieved).toBeUndefined();
  });

  test("should expire sessions after timeout", async () => {
    const manager = new SessionManager(100); // 100ms timeout

    manager.set("session-1", "user-key-1", mockKey);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    manager.cleanup();

    const retrieved = manager.get("session-1", "user-key-1");
    expect(retrieved).toBeUndefined();
  });
});
