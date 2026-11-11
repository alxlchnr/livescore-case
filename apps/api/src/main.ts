import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as swaggerUi from 'swagger-ui-express';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const specPath = join(__dirname, 'openapi.yaml');
  app.use('/api/openapi.yaml', (_: Request, response: Response) => {
    response.type('application/yaml').send(readFileSync(specPath, 'utf8'));
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'Livescore API',
      swaggerOptions: { url: '/api/openapi.yaml', persistAuthorization: true },
    }),
  );

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  // Set when Nx waits for this server to be ready
  if (process.env['NX_READY_SIGNAL_SOCKET']) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(`API läuft unter http://localhost:${port}/api, Swagger UI unter http://localhost:${port}/api/docs`);
}

bootstrap();
