import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: config.get<string>('FRONTEND_URL') || '*', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Edu CRM backend http://localhost:${port}/api manzilida ishga tushdi`);
}
bootstrap();
