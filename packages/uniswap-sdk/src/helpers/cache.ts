import { LRUCache } from "lru-cache";

export type CacheAdapter = {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): void | Promise<void>;
};

export function createDefaultCache() {
  const cache = new LRUCache<string, object>({
    max: 1000,
    ttl: 1000 * 60 * 60 * 24 * 30,
  });

  return {
    get<T>(key: string) {
      return cache.get(key) as T | undefined;
    },
    set<T>(key: string, value: T, ttlMs?: number) {
      if (ttlMs) {
        cache.set(key, value as object, { ttl: ttlMs });
      } else {
        cache.set(key, value as object);
      }
    },
  } satisfies CacheAdapter;
}

export async function getFromCache<T>(cache: CacheAdapter, key: string): Promise<T | undefined> {
  return cache.get(key);
}

export async function setToCache<T>(cache: CacheAdapter, key: string, value: T, ttlMs?: number): Promise<void> {
  await cache.set(key, value, ttlMs);
}
