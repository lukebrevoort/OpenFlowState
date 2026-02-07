import { describe, expect, it, vi } from 'vitest';
import { LruCache } from './index.js';

describe('LruCache', () => {
  it('evicts least recently used entries', () => {
    const cache = new LruCache<number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);

    // Touch "a" so "b" becomes LRU
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('expires entries using default ttl', () => {
    vi.useFakeTimers();
    const cache = new LruCache<number>({ maxEntries: 2, ttlMs: 1000 });
    cache.set('a', 1);

    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('supports per-entry ttl overrides', () => {
    vi.useFakeTimers();
    const cache = new LruCache<number>({ maxEntries: 2, ttlMs: 5000 });
    cache.set('a', 1, { ttlMs: 50 });

    vi.advanceTimersByTime(51);
    expect(cache.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('deletes and clears entries', () => {
    const cache = new LruCache<number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
