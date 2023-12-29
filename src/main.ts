import { CommandFactory } from 'nest-commander';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppService } from './app.service';

bootstrap();

async function bootstrap() {
  const app = await CommandFactory.createWithoutRunning(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  const appService = app.get(AppService);
  appService.onClose(() => app.close());

  try {
    await CommandFactory.runApplication(app);
  } catch (error) {
    logger.error(error);
    appService.close();
  }
}
