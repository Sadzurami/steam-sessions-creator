import fs from 'fs/promises';
import inquirer from 'inquirer';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Proxy as IProxy } from '../../interfaces/proxy.interface';

class Proxy implements IProxy {
  public readonly host: string;
  public readonly port: number;
  public readonly protocol: string;
  public readonly auth?: { username: string; password: string };

  constructor(proxy: string) {
    if (!/^(https?|socks5?):\/\/([-\w:@.^&]+)$/.test(proxy)) throw new Error('Invalid proxy');

    const url = new URL(proxy);

    this.host = url.hostname;
    this.port = Number(url.port);
    this.protocol = url.protocol.replace(/:$/, '');

    if (url.username.length > 0 && url.password.length > 0) {
      this.auth = { username: url.username, password: url.password };
    }
  }

  public toString() {
    return this.auth
      ? `${this.protocol}://${this.auth.username}:${this.auth.password}@${this.host}:${this.port}`
      : `${this.protocol}://${this.host}:${this.port}`;
  }
}

@Injectable()
export class ProxiesImportService {
  private readonly logger = new Logger(ProxiesImportService.name);

  public async loadProxies(input: string[] | string) {
    if (!input) return [];
    if (!Array.isArray(input)) input = [input];
    if (input.length === 0) return [];
    let proxies: Proxy[] = [];
    const errors: string[] = [];

    const readResults = await Promise.all(input.map((input) => this.readProxyFromInput(input)));
    for (const result of readResults) {
      proxies.push(...result.values);
      errors.push(...result.errors);
    }

    proxies = this.removeDuplicates(proxies);

    if (errors.length > 0) {
      this.logger.warn(`The following proxy sources are invalid:\n${errors.join('\n')}`);
      await delay(1000);

      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: proxies.length > 0 ? `Continue with ${proxies.length} valid proxies ?` : 'Continue without proxies ?',
        default: false,
      });

      if (!confirm) throw new Error('Aborted by user');
    }

    return proxies;
  }

  private removeDuplicates(proxies: Proxy[]) {
    const map = new Map<string, Proxy>();
    for (const proxy of proxies) map.set(proxy.toString(), proxy);
    return [...map.values()];
  }

  private async readProxyFromInput(input: string) {
    const inputType = await this.inferInputType(input);
    if (inputType === 'file') return await this.readProxyFromFile(input);
    if (inputType === 'string') return this.readProxyFromString(input);
    if (inputType === 'directory') return { values: [], errors: [input] };
  }

  private readProxyFromString(str: string) {
    const result: { values: Proxy[]; errors: string[] } = { values: [], errors: [] };

    try {
      const proxy = new Proxy(str);
      result.values.push(proxy);
    } catch (error) {
      result.errors.push(str);
    }

    return result;
  }

  private async readProxyFromFile(path: string) {
    const result: { values: Proxy[]; errors: string[] } = { values: [], errors: [] };

    try {
      const file = await fs.readFile(path, 'utf8');

      const lines = file
        .split(/\s+|\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) throw new Error(`File '${path}' is empty`);

      for (const line of lines) {
        const { values, errors } = this.readProxyFromString(line);
        result.values.push(...values);
        result.errors.push(...errors);
      }
    } catch (error) {
      result.errors.push(path);
    }

    return result;
  }

  private async inferInputType(input: string) {
    if (typeof input !== 'string') throw new Error(`Invalid input type: '${typeof input}'`);

    try {
      const stats = await fs.stat(input);
      if (stats.isFile()) return 'file';
      if (stats.isDirectory()) return 'directory';
    } catch (error) {
      return 'string';
    }
  }
}
