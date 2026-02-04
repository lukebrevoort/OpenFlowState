/**
 * FlowState Cache Utilities
 *
 * Lightweight in-memory LRU cache with optional TTL support.
 */

export type LruCacheOptions = {
  maxEntries?: number;
  ttlMs?: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt?: number;
};

export class LruCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private defaultTtlMs?: number;

  constructor(options: number | LruCacheOptions = {}) {
    if (typeof options === 'number') {
      this.maxEntries = options;
    } else {
      this.maxEntries = options.maxEntries ?? 100;
      this.defaultTtlMs = options.ttlMs;
    }
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, options?: { ttlMs?: number }): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.map.set(key, { value, expiresAt });

    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey) {
        this.map.delete(oldestKey);
      }
    }
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
