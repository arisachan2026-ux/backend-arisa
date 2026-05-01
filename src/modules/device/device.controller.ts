import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { DeviceService } from './device.service';
import {
  RegisterDeviceDto,
  PairStartDto,
  PairConfirmDto,
  HeartbeatDto,
} from './dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeviceAuthGuard } from '../../common/guards/device-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentDevice } from '../../common/decorators/current-device.decorator';

@ApiTags('Devices')
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  // ─── Public (Pi registration) ──────────────────────────────────

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new device (called by Pi on first boot)',
  })
  @ApiResponse({
    status: 201,
    description: 'Device registered, token returned',
  })
  @ApiResponse({ status: 401, description: 'Invalid registration secret' })
  @ApiResponse({ status: 409, description: 'Device serial already exists' })
  async register(@Body() dto: RegisterDeviceDto) {
    return this.deviceService.registerDevice(dto);
  }

  // ─── User-authenticated (mobile app) ───────────────────────────

  @Post('pair/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Generate pairing code for a device' })
  @ApiResponse({ status: 200, description: 'Pairing code + QR data returned' })
  async pairStart(@Body() dto: PairStartDto) {
    return this.deviceService.startPairing(dto.deviceId);
  }

  @Post('pair/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirm pairing — bind device to current user' })
  @ApiResponse({ status: 200, description: 'Device paired' })
  @ApiResponse({ status: 403, description: 'Invalid pairing code' })
  @ApiResponse({ status: 410, description: 'Pairing code expired' })
  async pairConfirm(
    @Body() dto: PairConfirmDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.deviceService.confirmPairing(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all devices for the current user' })
  @ApiResponse({ status: 200, description: 'Device list' })
  async listDevices(@CurrentUser('id') userId: string) {
    return this.deviceService.listUserDevices(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get device detail (ownership check)' })
  @ApiResponse({ status: 200, description: 'Device detail' })
  @ApiResponse({ status: 403, description: 'Not device owner' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getDevice(
    @Param('id') deviceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.deviceService.getDeviceDetail(deviceId, userId);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke (unpair) device from current user' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revokeDevice(
    @Param('id') deviceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.deviceService.revokeDevice(deviceId, userId);
  }

  // ─── Device-authenticated (Pi heartbeat) ───────────────────────

  @Post(':id/heartbeat')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('device-token')
  @ApiOperation({ summary: 'Send heartbeat from device' })
  @ApiResponse({ status: 200, description: 'Heartbeat acknowledged' })
  async heartbeat(@Param('id') deviceId: string, @Body() dto: HeartbeatDto) {
    return this.deviceService.heartbeat(deviceId, dto);
  }
}
