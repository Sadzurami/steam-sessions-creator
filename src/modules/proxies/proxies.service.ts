import pQueue from 'p-queue';

import Cache, { SetOptions as CacheSetOptions } from '@isaacs/ttlcache';
import { Injectable } from '@nestjs/common';

import { Proxy } from '../../interfaces/proxy.interface';

@Injectable()
export class ProxiesService {
  private readonly proxies: Map<string, Proxy> = new Map();
  private readonly throttledProxies = new Cache<string, Proxy>({ ttl: 35 * 1000 + 1000 });
  private readonly proxiesUsageQueue = new pQueue({ concurrency: 1 });

  public setProxies(proxies: Proxy[]) {
    if (proxies.length === 0) return;

    for (const proxy of proxies) {
      this.proxies.set(proxy.toString(), proxy);
    }
  }

  public async getProxy() {
    if (this.proxies.size === 0) throw new Error('No proxies available');
    const proxy = await this.proxiesUsageQueue.add(() => this.fetchProxy());
    this.throttleProxy(proxy);
    return proxy;
  }

  public getProxiesCount() {
    return this.proxies.size;
  }

  public throttleProxy(proxy: Proxy, timeoutMs?: number) {
    const options: CacheSetOptions = {};
    if (timeoutMs) options.ttl = timeoutMs;
    this.throttledProxies.set(proxy.toString(), proxy, options);
  }

  private async fetchProxy() {
    const proxy = await new Promise<Proxy>((resolve) => {
      let proxy = this.findAvailableProxy();
      if (proxy) return resolve(proxy);

      const interval = setInterval(() => {
        proxy = this.findAvailableProxy();
        if (!proxy) return;

        clearInterval(interval);
        resolve(proxy);
      }, 1000).unref();
    });

    return proxy;
  }

  private findAvailableProxy(): Proxy | null {
    for (const proxy of this.proxies.values()) {
      if (this.throttledProxies.has(proxy.toString())) continue;
      return proxy;
    }

    return null;
  }
}
