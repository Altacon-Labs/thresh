import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './framework/exceptions/all-exception.filter';
import { ResponseService } from './framework/response/response.service';




async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ forbidUnknownValues: true,whitelist: true,forbidNonWhitelisted: true }));
  const responseService = app.get(ResponseService);
  app.useGlobalFilters(new AllExceptionsFilter(responseService));


  app.setGlobalPrefix("/api");

  const config = new DocumentBuilder()
        .setTitle("Thresh API")
        .setDescription("Inventory verification and valuation on Stellar Testnet")
        .setVersion("1.0")
        .addBearerAuth()
        .build()

  const document = SwaggerModule.createDocument(app, config); 
  SwaggerModule.setup('/', app, document);
  const port = process.env.PORT || 3000;
  console.log(`Server is running on http://localhost:${port}/api`);
  await app.listen(port);
  
}
bootstrap();
