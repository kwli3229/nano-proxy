import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("Integration Tests", () => {
  let serverUrl = "http://localhost:3000";

  test("health check should return ok", async () => {
    const response = await fetch(`${serverUrl}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  test("should reject request without auth header", async () => {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }]
      })
    });

    expect(response.status).toBe(401);
  });

  // Add more integration tests as needed
});
