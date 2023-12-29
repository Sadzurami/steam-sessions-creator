import fs from 'fs/promises';
import path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Config } from '../../config/interfaces/config.interface';
import { ReportsConfig } from '../../config/interfaces/reports.config.interface';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(private readonly config: ConfigService<Config>) {}

  public async export(report: Record<string, any>) {
    const filePath = this.getExportFilePath();

    const fileContent = Object.entries(report)
      .map(([key, value]) => `${key[0].toUpperCase() + key.slice(1)}:\n\n${value}`)
      .join('\n\n');

    try {
      await fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
    } catch (error) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    await fs.writeFile(filePath, fileContent, 'utf8');
    this.logger.verbose(`File ${filePath} successfully exported`);
  }

  private getExportFilePath(): string {
    try {
      const { filePath } = this.config.get<ReportsConfig>('reports');
      return filePath;
    } catch (error) {
      throw new Error('Failed to get export file path');
    }
  }
}
