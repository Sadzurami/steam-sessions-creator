import { Cache } from 'cache-manager';
import pQueue from 'p-queue';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';

import { Proxy } from '../../interfaces/proxy.interface';

@Injectable()
export class ProxiesService {
  private readonly proxies: Map<string, Proxy> = new Map();
  private readonly proxiesUsageQueue = new pQueue({ concurrency: 1 });

  constructor(@Inject(CACHE_MANAGER) private throttledProxies: Cache) {}

  public setProxies(proxies: Proxy[]) {
    if (proxies.length === 0) return;

    for (const proxy of proxies) {
      this.proxies.set(proxy.toString(), proxy);
    }
  }

  public async getProxy(): Promise<Proxy | null> {
    if (this.proxies.size === 0) return null;
    const proxy = await this.proxiesUsageQueue.add(() => this.fetchProxy());
    this.throttleProxy(proxy);
    return proxy;
  }

  public getProxiesCount() {
    return this.proxies.size;
  }

  public throttleProxy(proxy: Proxy | string, timeoutMs?: number) {
    const proxyId = this.getProxyId(proxy);
    this.throttledProxies.set(proxyId, true, timeoutMs);
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
      }, 1000);
    });

    return proxy;
  }

  private findAvailableProxy(): Proxy | null {
    for (const proxy of this.proxies.values()) {
      const proxyId = this.getProxyId(proxy);
      if (this.throttledProxies.get(proxyId)) continue;
      return proxy;
    }

    return null;
  }

  private getProxyId(proxy: Proxy | string) {
    return `${ProxiesService.name}:${proxy.toString()}`;
  }
}
