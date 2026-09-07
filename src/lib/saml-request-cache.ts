import type { CacheItem, CacheProvider } from "@node-saml/node-saml";

type BoundedSamlRequestCacheOptions = {
  capacity: number;
  keyExpirationPeriodMs: number;
};

export class BoundedSamlRequestCache implements CacheProvider {
  private readonly cache = new Map<string, CacheItem>();

  constructor(private readonly options: BoundedSamlRequestCacheOptions) {}

  private prune(now: number): void {
    for (const [key, item] of this.cache) {
      if (now >= item.createdAt + this.options.keyExpirationPeriodMs) {
        this.cache.delete(key);
      }
    }
  }

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const now = Date.now();
    this.prune(now);

    if (this.cache.has(key)) {
      return null;
    }

    if (this.cache.size >= this.options.capacity) {
      throw new Error("SAML request cache capacity reached");
    }

    const item: CacheItem = {
      value,
      createdAt: now,
    };

    this.cache.set(key, item);
    return item;
  }

  async getAsync(key: string): Promise<string | null> {
    this.prune(Date.now());

    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    this.cache.delete(key);
    return item.value;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (key !== null) {
      this.cache.delete(key);
    }

    return null;
  }
}
