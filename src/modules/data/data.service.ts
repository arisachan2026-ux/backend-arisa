import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    data: { dataType: string; dataJson: any; deviceId?: string },
  ) {
    const record = await this.prisma.coreData.create({
      data: {
        userId,
        deviceId: data.deviceId || null,
        dataType: data.dataType,
        dataJson: data.dataJson,
        source: 'app',
      },
    });
    return record;
  }

  async findAll(
    userId: string,
    query: { page?: number; limit?: number; dataType?: string },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.dataType) where.dataType = query.dataType;

    const [items, total] = await Promise.all([
      this.prisma.coreData.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          dataType: true,
          dataJson: true,
          version: true,
          source: true,
          eventId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.coreData.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(recordId: string, userId: string) {
    const record = await this.prisma.coreData.findUnique({
      where: { id: recordId },
    });
    if (!record) throw new NotFoundException(ErrorCode.DATA_NOT_FOUND);
    if (record.userId !== userId)
      throw new ForbiddenException(ErrorCode.DATA_OWNERSHIP_DENIED);
    return record;
  }

  async update(
    recordId: string,
    userId: string,
    data: { dataJson?: any; dataType?: string },
  ) {
    const record = await this.findOne(recordId, userId);
    return this.prisma.coreData.update({
      where: { id: record.id },
      data: {
        ...(data.dataJson && { dataJson: data.dataJson }),
        ...(data.dataType && { dataType: data.dataType }),
        version: { increment: 1 },
      },
    });
  }

  async remove(recordId: string, userId: string) {
    await this.findOne(recordId, userId);
    await this.prisma.coreData.delete({ where: { id: recordId } });
    return { message: 'Record deleted' };
  }
}
