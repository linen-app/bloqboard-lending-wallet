import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const options = new DocumentBuilder()
    .setTitle('Bloqboard Lending Wallet')
    .setDescription('Bloqboard Lending Wallet API description')
    .setVersion('0.1')
    .addTag('Wallet', 'Check token balances in your connected address')
    .addTag('Dharma @ Bloqboard', 'Borrow and lend digital assets using Bloqboard lending platform and Dharma protocol')
    .addTag('Compound', 'Open-source protocol for algorithmic, efficient Money Markets on the Ethereum blockchain')
    .addTag('Kyber Network', 'Performs decentralized and instant token swaps')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();