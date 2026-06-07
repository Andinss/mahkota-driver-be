import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Serve static files dari folder image/
  app.useStaticAssets(join(__dirname, '..', 'image'), {
    prefix: '/image/',
  });
  // Serve static files dari folder images/ (old path)
  app.useStaticAssets(join(__dirname, '..', 'images'), {
    prefix: '/images/',
  });
  const allowedOrigins: string[] = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter((o): o is string => !!o);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();
