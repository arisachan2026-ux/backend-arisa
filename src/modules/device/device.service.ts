import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto, PairConfirmDto, HeartbeatDto } from './dto';
import { ErrorCode } from '../../common/constants/error-codes';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register a new device (called by Pi on first boot).
   * Verifies the registration secret, generates a device token.
   */
  async registerDevice(dto: RegisterDeviceDto) {
    // Verify registration secret
    const expectedSecret = this.config.get<string>(
      'security.deviceRegistrationSecret',
    );
    if (dto.registrationSecret !== expectedSecret) {
      throw new UnauthorizedException(
        ErrorCode.DEVICE_REGISTRATION_SECRET_INVALID,
      );
    }

    // Check if serial already exists
    const existing = await this.prisma.device.findUnique({
      where: { deviceSerial: dto.deviceSerial },
    });
    if (existing) {
      throw new ConflictException(ErrorCode.DEVICE_SERIAL_EXISTS);
    }

    // Generate device token (48 bytes = 96 hex chars)
    const rawToken = crypto.randomBytes(48).toString('hex');
    const saltRounds = this.config.get<number>(
      'security.deviceTokenSaltRounds',
      12,
    );
    const tokenHash = await bcrypt.hash(rawToken, saltRounds);

    // Create device record
    const device = await this.prisma.device.create({
      data: {
        deviceName: dto.deviceName,
        deviceSerial: dto.deviceSerial,
        tokenHash,
        firmwareVersion: dto.firmwareVersion || null,
        pairingStatus: 'UNPAIRED',
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Device registered: ${device.id} (${device.deviceSerial})`);

    return {
      deviceId: device.id,
      deviceToken: rawToken, // Only returned ONCE — Pi must store this
      deviceSerial: device.deviceSerial,
      deviceName: device.deviceName,
    };
  }

  /**
   * Generate a pairing code for a device (called by admin or device setup).
   */
  async startPairing(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(ErrorCode.DEVICE_NOT_FOUND);
    }

    // B3: Prevent pairing on disabled/decommissioned devices
    if (device.status !== 'ACTIVE') {
      throw new ForbiddenException(ErrorCode.DEVICE_DISABLED);
    }

    // Generate 6-char alphanumeric code
    const pairingCode = this.generatePairingCode();
    const expiryMinutes = this.config.get<number>(
      'security.pairingCodeExpiryMinutes',
      10,
    );
    const pairingExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        pairingCode,
        pairingExpiry,
        pairingStatus: 'PAIRING',
      },
    });

    this.logger.log(
      `Pairing code generated for device: ${deviceId} (expires in ${expiryMinutes} min)`,
    );

    return {
      pairingCode,
      expiresAt: pairingExpiry.toISOString(),
      deviceId: device.id,
      deviceName: device.deviceName,
      qrData: `arisa://pair?code=${pairingCode}&device=${deviceId}`,
    };
  }

  /**
   * Confirm pairing — bind device to user (called by mobile app after QR scan).
   */
  async confirmPairing(dto: PairConfirmDto, userId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
      include: {
        owners: { where: { revokedAt: null } },
      },
    });

    if (!device) {
      throw new NotFoundException(ErrorCode.DEVICE_NOT_FOUND);
    }

    // Validate pairing code
    if (!device.pairingCode || device.pairingCode !== dto.pairingCode) {
      throw new ForbiddenException(ErrorCode.DEVICE_PAIRING_CODE_INVALID);
    }

    // Check expiry
    if (!device.pairingExpiry || new Date() > device.pairingExpiry) {
      // Nullify expired code
      await this.prisma.device.update({
        where: { id: dto.deviceId },
        data: {
          pairingCode: null,
          pairingExpiry: null,
          pairingStatus: 'UNPAIRED',
        },
      });
      throw new GoneException(ErrorCode.DEVICE_PAIRING_CODE_EXPIRED);
    }

    // Check if already paired to this user
    const existingOwnership = device.owners.find((o) => o.userId === userId);
    if (existingOwnership) {
      throw new ConflictException(ErrorCode.DEVICE_ALREADY_PAIRED);
    }

    // Bind device to user (transaction)
    await this.prisma.$transaction([
      this.prisma.userDevice.create({
        data: {
          userId,
          deviceId: dto.deviceId,
          isPrimary: device.owners.length === 0, // First owner = primary
        },
      }),
      this.prisma.device.update({
        where: { id: dto.deviceId },
        data: {
          pairingCode: null, // Single-use
          pairingExpiry: null,
          pairingStatus: 'PAIRED',
        },
      }),
    ]);

    this.logger.log(`Device ${dto.deviceId} paired to user ${userId}`);

    return {
      message: 'Device paired successfully',
      deviceId: dto.deviceId,
      deviceName: device.deviceName,
    };
  }

  /**
   * List all devices owned by a user.
   */
  async listUserDevices(userId: string) {
    const userDevices = await this.prisma.userDevice.findMany({
      where: { userId, revokedAt: null },
      include: {
        device: {
          select: {
            id: true,
            deviceName: true,
            deviceSerial: true,
            pairingStatus: true,
            status: true,
            firmwareVersion: true,
            lastSeenAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { pairedAt: 'desc' },
    });

    return userDevices.map((ud) => ({
      ...ud.device,
      isPrimary: ud.isPrimary,
      pairedAt: ud.pairedAt,
    }));
  }

  /**
   * Get device detail (with ownership check).
   */
  async getDeviceDetail(deviceId: string, userId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        deviceName: true,
        deviceSerial: true,
        pairingStatus: true,
        status: true,
        firmwareVersion: true,
        appVersion: true,
        lastSeenAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        owners: {
          where: { revokedAt: null },
          select: { userId: true, isPrimary: true, pairedAt: true },
        },
        _count: {
          select: { syncJobs: true, telemetry: true },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(ErrorCode.DEVICE_NOT_FOUND);
    }

    // Ownership check
    const isOwner = device.owners.some((o) => o.userId === userId);
    if (!isOwner) {
      throw new ForbiddenException(ErrorCode.DATA_OWNERSHIP_DENIED);
    }

    return {
      ...device,
      stats: {
        syncJobsCount: device._count.syncJobs,
        telemetryCount: device._count.telemetry,
      },
      _count: undefined,
    };
  }

  /**
   * Revoke (unpair) a device from a user.
   */
  async revokeDevice(deviceId: string, userId: string) {
    const userDevice = await this.prisma.userDevice.findFirst({
      where: { deviceId, userId, revokedAt: null },
    });

    if (!userDevice) {
      throw new NotFoundException(ErrorCode.DEVICE_NOT_FOUND);
    }

    // Revoke this user's ownership link
    await this.prisma.userDevice.update({
      where: { id: userDevice.id },
      data: { revokedAt: new Date() },
    });

    // B2: Check if device has remaining active owners before setting REVOKED
    const remainingOwners = await this.prisma.userDevice.count({
      where: { deviceId, revokedAt: null },
    });

    if (remainingOwners === 0) {
      // No more owners — mark device as revoked
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { pairingStatus: 'REVOKED' },
      });
    }

    this.logger.log(
      `Device ${deviceId} revoked from user ${userId} (remaining owners: ${remainingOwners})`,
    );

    return { message: 'Device revoked' };
  }

  /**
   * Process heartbeat from device (called by Pi periodically).
   */
  async heartbeat(deviceId: string, dto: HeartbeatDto) {
    const updateData: any = { lastSeenAt: new Date() };

    if (dto.firmwareVersion) {
      updateData.firmwareVersion = dto.firmwareVersion;
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: updateData,
    });

    return {
      acknowledged: true,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Generate a 6-character alphanumeric pairing code.
   */
  private generatePairingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }
}
