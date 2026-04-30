import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user profile by ID.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            devices: true,
            coreData: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return {
      ...user,
      stats: {
        devicesCount: user._count.devices,
        dataCount: user._count.coreData,
      },
      _count: undefined,
    };
  }

  /**
   * Update user profile.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Profile updated: ${userId}`);

    return updated;
  }

  /**
   * Soft-delete user account.
   * Sets status to DELETED and revokes all device pairings.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    // Revoke all device pairings
    await this.prisma.userDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Soft delete user
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' as any },
    });

    this.logger.warn(`Account deleted (soft): ${userId}`);

    return { message: 'Account deleted successfully' };
  }
}
