import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncPushDto, SyncBatchDto, SyncAckDto } from './dto';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Push a single sync item from device to cloud.
   * IDEMPOTENT: if requestId already exists, return existing job.
   */
  async push(dto: SyncPushDto, deviceId: string) {
    // Idempotency check
    const existing = await this.prisma.syncJob.findUnique({
      where: { requestId: dto.requestId },
    });

    if (existing) {
      this.logger.log(`Duplicate sync push ignored: ${dto.requestId}`);
      return {
        jobId: existing.id,
        requestId: existing.requestId,
        status: existing.status,
        duplicate: true,
      };
    }

    // Validate device-user ownership
    await this.validateDeviceOwnership(deviceId, dto.userId);

    // Create sync job (processing inline since BullMQ requires Redis)
    const syncJob = await this.prisma.syncJob.create({
      data: {
        requestId: dto.requestId,
        deviceId,
        userId: dto.userId,
        payloadType: dto.eventType,
        payloadRaw: dto.payload as any,
        status: 'PENDING',
      },
    });

    // Process immediately (in production with Redis, this would be queued via BullMQ)
    await this.processJob(syncJob.id);

    return {
      jobId: syncJob.id,
      requestId: syncJob.requestId,
      status: 'SYNCED',
      duplicate: false,
    };
  }

  /**
   * Push a batch of sync items.
   */
  async pushBatch(dto: SyncBatchDto, deviceId: string) {
    if (dto.items.length > 100) {
      throw new BadRequestException(ErrorCode.SYNC_BATCH_TOO_LARGE);
    }

    // B9: Process items in parallel using Promise.allSettled
    const settledResults = await Promise.allSettled(
      dto.items.map((item) => this.push(item, deviceId)),
    );

    let accepted = 0;
    let skipped = 0;
    const results: any[] = [];

    for (let i = 0; i < settledResults.length; i++) {
      const settled = settledResults[i];
      const item = dto.items[i];

      if (settled.status === 'fulfilled') {
        const result = settled.value;
        results.push({
          requestId: item.requestId,
          jobId: result.jobId,
          status: result.duplicate ? 'SKIPPED' : 'ACCEPTED',
        });
        if (result.duplicate) skipped++;
        else accepted++;
      } else {
        results.push({
          requestId: item.requestId,
          status: 'FAILED',
          error: settled.reason?.message || 'Unknown error',
        });
      }
    }

    return { accepted, skipped, failed: results.length - accepted - skipped, results };
  }

  /**
   * Get sync job status.
   */
  async getJobStatus(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        requestId: true,
        status: true,
        payloadType: true,
        retryCount: true,
        errorMessage: true,
        processedAt: true,
        createdAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException(ErrorCode.SYNC_JOB_NOT_FOUND);
    }

    return job;
  }

  /**
   * Acknowledge synced items — mark as fully processed.
   */
  async acknowledge(dto: SyncAckDto) {
    const result = await this.prisma.syncJob.updateMany({
      where: {
        id: { in: dto.jobIds },
        status: 'SYNCED',
      },
      data: {
        status: 'SYNCED', // Already synced — just confirm
      },
    });

    return { acknowledged: result.count };
  }

  /**
   * Pull updates from cloud (Cloud → Pi direction).
   */
  async pull(since: string, limit: number = 50, userId?: string) {
    const sinceDate = new Date(since);

    const items = await this.prisma.coreData.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        ...(userId && { userId }),
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        dataType: true,
        dataJson: true,
        version: true,
        source: true,
        updatedAt: true,
      },
    });

    const cursor =
      items.length > 0
        ? items[items.length - 1].updatedAt.toISOString()
        : since;

    return {
      items,
      cursor,
      count: items.length,
    };
  }

  /**
   * Process a sync job — write to core_data.
   * In production, this runs in BullMQ worker.
   */
  private async processJob(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    try {
      // Update job to PROCESSING
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      // Check for conflict (existing data with same requestId as eventId)
      const existing = await this.prisma.coreData.findUnique({
        where: { eventId: job.requestId },
      });

      if (existing) {
        // LWW conflict resolution: compare versions properly
        // The version from SyncPushDto is stored as metadata in the job
        const incomingVersion = (job.payloadRaw as any)?.version ?? 1;

        if (existing.version >= incomingVersion) {
          // Cloud wins — skip
          await this.prisma.syncJob.update({
            where: { id: jobId },
            data: {
              status: 'SYNCED',
              processedAt: new Date(),
            },
          });
          return;
        }

        // Pi has newer version — update
        await this.prisma.coreData.update({
          where: { id: existing.id },
          data: {
            dataJson: job.payloadRaw as any,
            version: incomingVersion,
            source: 'edge',
          },
        });
      } else {
        // No conflict — create new record
        const incomingVersion = (job.payloadRaw as any)?.version ?? 1;
        await this.prisma.coreData.create({
          data: {
            userId: job.userId,
            deviceId: job.deviceId,
            dataType: job.payloadType,
            dataJson: job.payloadRaw as any,
            version: incomingVersion,
            source: 'edge',
            eventId: job.requestId,
          },
        });
      }

      // Mark job as synced
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'SYNCED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });
    }
  }

  /**
   * Validate that device is owned by the specified user.
   */
  private async validateDeviceOwnership(
    deviceId: string,
    userId: string,
  ) {
    const ownership = await this.prisma.userDevice.findFirst({
      where: {
        deviceId,
        userId,
        revokedAt: null,
      },
    });

    if (!ownership) {
      throw new BadRequestException(ErrorCode.SYNC_OWNERSHIP_MISMATCH);
    }
  }

  /**
   * Ingest IoT session summary from Raspberry Pi.
   * These summaries are used by AI Gateway to inject agricultural context
   * into the AI system prompt (via buildIotContext).
   */
  async ingestSessionSummary(
    dto: {
      userId: string;
      sessionStart: string;
      sessionEnd: string;
      summary: string;
      metrics: Record<string, any>;
      alerts?: any[];
      recommendations?: any[];
      dataPointCount: number;
    },
    deviceId: string,
  ) {
    // Validate device-user ownership
    await this.validateDeviceOwnership(deviceId, dto.userId);

    const record = await this.prisma.sessionSummary.create({
      data: {
        deviceId,
        userId: dto.userId,
        sessionStart: new Date(dto.sessionStart),
        sessionEnd: new Date(dto.sessionEnd),
        summary: dto.summary,
        metrics: dto.metrics as any,
        alerts: (dto.alerts as any) || [],
        recommendations: (dto.recommendations as any) || [],
        dataPointCount: dto.dataPointCount,
      },
    });

    this.logger.log(
      `Session summary ingested: ${record.id} (device: ${deviceId}, points: ${dto.dataPointCount})`,
    );

    return {
      id: record.id,
      sessionStart: record.sessionStart,
      sessionEnd: record.sessionEnd,
      dataPointCount: record.dataPointCount,
      syncedAt: record.syncedAt,
    };
  }
}
