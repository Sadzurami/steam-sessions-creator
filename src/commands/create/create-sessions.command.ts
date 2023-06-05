import glob from 'fast-glob';
import { Command, CommandRunner, Help, Option } from 'nest-commander';
import path from 'path';

import { Logger } from '@nestjs/common';

import { AccountsImportService } from '../../modules/accounts-import/accounts-import.service';
import { ExportSessionsService } from '../../modules/export-sessions/export-sessions.service';
import { ProxiesImportService } from '../../modules/proxies-import/proxies-import.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SecretsImportService } from '../../modules/secrets-import/secrets-import.service';
import { CreateSessionsService } from './create-sessions.service';

interface CreateCommandOptions {
  accounts: string | string[];
  secrets: string | string[];
  proxies: string | string[];
  output: string;
}

@Command({
  name: 'create',
  description: 'Creates new sessions',
})
export class CreateSessionsCommand extends CommandRunner {
  private readonly logger = new Logger(CreateSessionsCommand.name);

  constructor(
    private readonly createSessionsService: CreateSessionsService,
    private readonly exportSessionsService: ExportSessionsService,
    private readonly accountsImportService: AccountsImportService,
    private readonly secretsImportService: SecretsImportService,
    private readonly proxiesImportService: ProxiesImportService,
    private readonly proxiesService: ProxiesService,
  ) {
    super();
  }

  public async run(args: string[], options: CreateCommandOptions) {
    try {
      const accountsOptionInput = await this.normalizeInput(options.accounts);
      const accounts = await this.accountsImportService.loadAccounts(accountsOptionInput);
      if (accounts.length === 0) throw new Error('No accounts found');
      this.logger.log(`Accounts loaded: ${accounts.length}`);

      const secretsOptionInput = await this.normalizeInput(options.secrets);
      const secrets = await this.secretsImportService.loadSecrets(secretsOptionInput);
      this.createSessionsService.assignSecretsToAccounts(accounts, secrets);
      this.logger.log(`Secrets loaded: ${secrets.length}`);

      const proxiesOptionInput = await this.normalizeInput(options.proxies);
      const proxies = await this.proxiesImportService.loadProxies(proxiesOptionInput);
      this.proxiesService.setProxies(proxies);
      this.logger.log(`Proxies loaded: ${proxies.length}`);

      const outputOptionInput = options.output;
      if (!outputOptionInput) throw new Error('Output path is required');

      const output = path.resolve(outputOptionInput);
      await this.exportSessionsService.setOutputPath(output);
      this.logger.log(`Output path: ${output}`);

      this.logger.log('Creating sessions...');
      await this.createSessionsService.createAndExportSessions(accounts);
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  private async normalizeInput(input: string | string[]) {
    if (!input) return [];

    if (!Array.isArray(input)) input = [input];

    const filteredInput = input.filter((el) => typeof el === 'string' && el.trim() !== '');
    if (filteredInput.length === 0) return [];

    const nestedData = await Promise.all(
      filteredInput.map(async (el) => {
        el = el.trim();

        // Possible glob pattern
        const files = await glob(el);
        if (files.length > 0) return files;

        // Possible string
        return el.split(/\s+|\r?\n/).map((line) => line.trim());
      }),
    );

    return nestedData.flat();
  }

  @Option({
    required: true,
    flags: '-a, --accounts <accounts...>',
    description: `Specify one or more accounts.
Account can be specified as:
- A simple string.
- A file path to load accounts from (one account per line).
- A glob pattern to load accounts from multiple files.
Supported formats:
- username:password
- username:password:sharedSecret
- username:password:sharedSecret:identitySecret
- ASF json`,
  })
  private parseAccountsOption(val: string, accumulator: string[] = []) {
    accumulator.push(val);
    return accumulator;
  }

  @Option({
    flags: '-s, --secrets <secrets...>',
    description: `Specify one or more secrets.
Secret can be specified as:
- A file path to load secrets from file.
- A glob pattern to load secrets from multiple files.
Supported formats:
- maFile
- ASF db`,
  })
  private parseSecretsOption(val: string, accumulator: string[] = []) {
    accumulator.push(val);
    return accumulator;
  }

  @Option({
    flags: '-p, --proxies <proxies...>',
    description: `Specify one or more proxies.
Proxy can be specified as:
- A string in the format <protocol>://<username>:<password>@<host>:<port>.
- A file path to load proxies from a text file.
Supported protocols:
- http
- https`,
  })
  private parseProxiesOption(val: string, accumulator: string[] = []) {
    accumulator.push(val);
    return accumulator;
  }

  @Option({
    flags: '-o, --output <output>',
    description: 'Specify the output directory.',
    defaultValue: './sessions',
  })
  private parseOutputOption(val: string) {
    return val;
  }

  @Help('afterAll')
  private displayExamples() {
    return `
Examples:
  create -a accounts.txt -s ./secrets -p proxies.txt
  create -a username:password -p proxies.txt`;
  }
}
