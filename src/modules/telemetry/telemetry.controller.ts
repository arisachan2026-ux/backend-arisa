import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiSecurity,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { TelemetryPushDto } from './dto/telemetry-push.dto';
import { DeviceAuthGuard } from '../../common/guards/device-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentDevice } from '../../common/decorators/current-device.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiSecurity('device-token')
  @ApiOperation({ summary: 'Push telemetry data from device' })
  async push(
    @CurrentDevice('id') deviceId: string,
    @Body() dto: TelemetryPushDto,
  ) {
    return this.telemetryService.push(deviceId, dto);
  }

  @Get('device/:deviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get telemetry history for a device (ownership check)',
  })
  @ApiQuery({ name: 'limit', required: false })
  async getHistory(
    @Param('deviceId') deviceId: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.telemetryService.getHistory(
      deviceId,
      userId,
      limit ? Number(limit) : 50,
    );
  }
}
