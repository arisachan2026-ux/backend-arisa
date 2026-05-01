import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSawahDto, UpdateSawahDto } from './dto/weather.dto';

/**
 * SawahService — CRUD for rice paddy field locations.
 *
 * Each sawah belongs to one user and stores lat/lon
 * for weather lookups. Ownership is enforced on every operation.
 */
@Injectable()
export class SawahService {
  private readonly logger = new Logger(SawahService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSawahDto) {
    const sawah = await this.prisma.sawah.create({
      data: {
        userId,
        name: dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        luasHektar: dto.luasHektar ?? null,
        alamat: dto.alamat ?? null,
      },
    });

    this.logger.log(`Sawah created: ${sawah.id} by user ${userId}`);
    return {
      success: true,
      data: sawah,
    };
  }

  async findAll(userId: string) {
    const sawahList = await this.prisma.sawah.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: sawahList,
      total: sawahList.length,
    };
  }

  async findOne(sawahId: string, userId: string) {
    const sawah = await this.prisma.sawah.findUnique({
      where: { id: sawahId },
    });

    if (!sawah) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'SAWAH_NOT_FOUND',
          message: 'Sawah tidak ditemukan.',
        },
      });
    }

    if (sawah.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SAWAH_OWNERSHIP_DENIED',
          message: 'Anda tidak punya akses ke sawah ini.',
        },
      });
    }

    return {
      success: true,
      data: sawah,
    };
  }

  async update(sawahId: string, userId: string, dto: UpdateSawahDto) {
    // Ownership check
    await this.findOne(sawahId, userId);

    const updated = await this.prisma.sawah.update({
      where: { id: sawahId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.luasHektar !== undefined && { luasHektar: dto.luasHektar }),
        ...(dto.alamat !== undefined && { alamat: dto.alamat }),
      },
    });

    this.logger.log(`Sawah updated: ${sawahId} by user ${userId}`);
    return {
      success: true,
      data: updated,
    };
  }

  async remove(sawahId: string, userId: string) {
    // Ownership check
    await this.findOne(sawahId, userId);

    await this.prisma.sawah.delete({
      where: { id: sawahId },
    });

    this.logger.log(`Sawah deleted: ${sawahId} by user ${userId}`);
    return {
      success: true,
      message: 'Sawah berhasil dihapus.',
    };
  }
}
