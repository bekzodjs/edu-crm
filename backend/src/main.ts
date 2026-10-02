import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname, join } from 'path';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { INLINE_SAFE_EXTENSIONS } from './common/utils/upload';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const jwtSecret = config.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret === "o'zgartiring-maxfiy-kalit") {
    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error('JWT_SECRET o‘rnatilmagan yoki standart qiymatda — production rejimida ishga tushirib bo‘lmaydi');
    }
    logger.warn('JWT_SECRET o‘rnatilmagan yoki standart qiymatda. Production uchun albatta o‘zgartiring!');
  }

  const frontendUrl = config.get<string>('FRONTEND_URL');
  app.enableCors(frontendUrl ? { origin: frontendUrl.split(',').map((s) => s.trim()), credentials: true } : { origin: '*' });

  // whitelist: DTO'da e'lon qilinmagan maydonlar (masalan discountPct, studentIds, role ...)
  // tashlab yuboriladi — mass-assignment orqali ruxsatsiz maydonlarni o'zgartirishning oldi olinadi.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new MongoExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();

  // O'qituvchi hujjatlari (diplom/sertifikat) kabi yuklangan fayllar shu yerdan statik xizmat qiladi.
  // Xavfsiz bo'lmagan turlar (html, svg va h.k.) brauzerda ochilmaydi — faqat yuklab olinadi.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res, path) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!INLINE_SAFE_EXTENSIONS.has(extname(path).toLowerCase())) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      }
    },
  });

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
  logger.log(`Edu CRM backend http://localhost:${port}/api manzilida ishga tushdi`);
}
bootstrap();
