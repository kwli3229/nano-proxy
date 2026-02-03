import type { ProviderKey } from "./types";

interface SessionEntry {
  key: ProviderKey;
  expiresAt: number;
}

export class SessionManager {
  private sessions: Map<string, SessionEntry> = new Map();
  private timeout: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(timeout: number) {
    this.timeout = timeout;

    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  set(sessionId: string, userApiKey: string, key: ProviderKey): void {
    const sessionKey = this.makeKey(sessionId, userApiKey);
    this.sessions.set(sessionKey, {
      key,
      expiresAt: Date.now() + this.timeout
    });
  }

  get(sessionId: string, userApiKey: string): ProviderKey | undefined {
    const sessionKey = this.makeKey(sessionId, userApiKey);
    const entry = this.sessions.get(sessionKey);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionKey);
      return undefined;
    }

    return entry.key;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessions.entries()) {
      if (now > entry.expiresAt) {
        this.sessions.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }

  private makeKey(sessionId: string, userApiKey: string): string {
    return `${sessionId}:${userApiKey}`;
  }
}
