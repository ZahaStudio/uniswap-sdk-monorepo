import { LRUCache } from "lru-cache";

export type CacheAdapter = {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): void | Promise<void>;
};

export function createDefaultCache() {
  return new LRUCache({
    // max allow 1000 entries at a time
    max: 1000,
    // 30 days in milliseconds
    ttl: 1000 * 60 * 60 * 24 * 30,
  });
}

export async function getFromCache<T>(cache: CacheAdapter, key: string): Promise<T | undefined> {
  return cache.get(key);
}

export async function setToCache<T>(cache: CacheAdapter, key: string, value: T, ttlMs?: number): Promise<void> {
  await cache.set(key, value, ttlMs);
}
