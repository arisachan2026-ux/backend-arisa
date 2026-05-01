import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { OpenWeatherClient } from './openweather.client';
import { WeatherRecommendationEngine } from './weather-recommendation.engine';
import { SawahController } from './sawah.controller';
import { SawahService } from './sawah.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [WeatherController, SawahController],
  providers: [WeatherService, OpenWeatherClient, WeatherRecommendationEngine, SawahService],
  exports: [WeatherService],
})
export class WeatherModule {}
