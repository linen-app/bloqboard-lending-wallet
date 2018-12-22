import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const options = new DocumentBuilder()
    .setTitle('Bloqboard Lending Wallet')
    .setDescription('Bloqboard Lending Wallet API description')
    .setVersion('0.1')
    .addTag('Dharma @ Bloqboard', 'borrow and lend crypto-assets instantly using Bloqboard decentralized lending platform and Dharma protocol')
    .addTag('Compound', 'is an open-source protocol for algorithmic, efficient Money Markets on the Ethereum blockchain')
    .addTag('Kyber Network', 'performs decentralized and instant token swaps')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();