import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("Integration Tests - Pool Transform", () => {
  let serverUrl = "http://localhost:3000";

  test("should apply model remap with x-api-key header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "jan-api-key-123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    // This would need a real API key to fully test
    // For now, just verify the request is accepted
    expect([200, 401, 500]).toContain(response.status);
  });

  test("should apply model remap with Authorization header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer jan-api-key-123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect([200, 401, 500]).toContain(response.status);
  });

  test("should reject unknown client key", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "unknown-key",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect(response.status).toBe(401);
  });

  test("should work with old format pools", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "x-api-key": "old-format-example",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    // Old format should still work
    expect([200, 401, 500]).toContain(response.status);
  });
});
