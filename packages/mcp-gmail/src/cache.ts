type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

export class LruCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private maxEntries: number;

  constructor(maxEntries: number = 100) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, { value, timestamp: Date.now() });

    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey) {
        this.map.delete(oldestKey);
      }
    }
  }
}
