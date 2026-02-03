import type { ProviderKey } from "./types";

export class KeyPool {
  private pools: Record<string, ProviderKey[]>;
  private indices: Record<string, number> = {};

  constructor(pools: Record<string, ProviderKey[]>) {
    this.pools = pools;

    // Initialize indices for each pool
    for (const poolName in pools) {
      this.indices[poolName] = 0;
    }
  }

  selectKey(userApiKey: string): ProviderKey {
    const pool = this.pools[userApiKey];

    if (!pool || pool.length === 0) {
      throw new Error(`No keys available for pool: ${userApiKey}`);
    }

    // Get current index and increment (round-robin)
    const index = this.indices[userApiKey];
    this.indices[userApiKey] = (index + 1) % pool.length;

    return pool[index];
  }

  getPoolNames(): string[] {
    return Object.keys(this.pools);
  }

  hasPool(userApiKey: string): boolean {
    return userApiKey in this.pools;
  }
}
