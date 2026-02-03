import type { ProviderKey, PoolConfig, PoolTransform } from "./types";

export class KeyPool {
  private pools: Record<string, PoolConfig>;
  private indices: Record<string, number> = {};
  private clientKeyMap: Map<string, string> = new Map();  // clientKey → poolName

  constructor(pools: Record<string, PoolConfig>) {
    this.pools = pools;

    // Build client key mapping and initialize indices
    for (const [poolName, poolConfig] of Object.entries(pools)) {
      // Initialize round-robin index
      this.indices[poolName] = 0;

      // Build reverse map: client key → pool name
      for (const clientKey of poolConfig.accepts || []) {
        if (this.clientKeyMap.has(clientKey)) {
          throw new Error(
            `Duplicate client key "${clientKey}" found in pool "${poolName}". ` +
            `Already exists in pool "${this.clientKeyMap.get(clientKey)}"`
          );
        }
        this.clientKeyMap.set(clientKey, poolName);
      }
    }
  }

  /**
   * Get pool name by client API key
   */
  getPoolNameByClientKey(clientKey: string): string | undefined {
    return this.clientKeyMap.get(clientKey);
  }

  /**
   * Get pool transform configuration by pool name
   */
  getPoolTransform(poolName: string): PoolTransform | undefined {
    return this.pools[poolName]?.transform;
  }

  /**
   * Check if streaming is allowed for a pool
   */
  isStreamingAllowed(poolName: string): boolean {
    const pool = this.pools[poolName];
    // Default to true if not specified
    return pool?.isStreamingAllowed !== false;
  }

  /**
   * Select a provider key from a pool (round-robin)
   */
  selectKey(poolName: string): ProviderKey {
    const pool = this.pools[poolName];

    if (!pool || pool.keys.length === 0) {
      throw new Error(`No keys available for pool: ${poolName}`);
    }

    // Get current index and increment (round-robin)
    const index = this.indices[poolName];
    this.indices[poolName] = (index + 1) % pool.keys.length;

    return pool.keys[index];
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Object.keys(this.pools);
  }

  /**
   * Check if a pool exists by name
   */
  hasPool(poolName: string): boolean {
    return poolName in this.pools;
  }

  /**
   * Check if a client key is valid
   */
  hasClientKey(clientKey: string): boolean {
    return this.clientKeyMap.has(clientKey);
  }
}
