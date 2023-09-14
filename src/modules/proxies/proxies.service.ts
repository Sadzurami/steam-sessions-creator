import fs from 'fs/promises';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProxiesService {
  private readonly logger = new Logger(ProxiesService.name);

  private readonly proxies: string[] = [];
  private index = 0;

  constructor() {}

  public getOne(): string | null {
    if (this.proxies.length === 0) return null;

    const proxy = this.proxies[this.index];
    this.index = (this.index + 1) % this.proxies.length;

    return proxy;
  }

  public getCount() {
    return this.proxies.length;
  }

  public async importAll(filePath: string) {
    if (!filePath) return;

    try {
      await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      this.logger.verbose(`File ${filePath} does not exist or is not readable`);
      return;
    }

    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.debug(new Error(`Failed to read file ${filePath}`), { cause: error });
      return;
    }

    const lines = fileContent.split(/\s+|\r?\n/).map((line) => line.trim());
    if (lines.length === 0) return;

    const proxies: string[] = [];

    let lineIndex = 0;
    for (const line of lines) {
      lineIndex++;

      try {
        const proxy = new URL(line).toString().replace(/\/$/, '');
        if (!proxies.includes(proxy)) proxies.push(proxy);
      } catch (error) {
        this.logger.debug(new Error(`Invalid proxy at line ${lineIndex}`, { cause: error }));
      }
    }

    this.proxies.push(...proxies);
    this.logger.verbose(`Imported ${proxies.length} proxies from file ${filePath}`);
  }
}
