import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      activeUsers,
      totalDevices,
      pairedDevices,
      totalSyncJobs,
      pendingSyncJobs,
      failedSyncJobs,
      totalDataRecords,
      totalAiRequests,
      todayAiRequests,
      totalSessionSummaries,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.device.count(),
      this.prisma.device.count({ where: { pairingStatus: 'PAIRED' } }),
      this.prisma.syncJob.count(),
      this.prisma.syncJob.count({ where: { status: 'PENDING' } }),
      this.prisma.syncJob.count({ where: { status: 'FAILED' } }),
      this.prisma.coreData.count(),
      this.prisma.aiRequest.count(),
      this.prisma.aiRequest.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.sessionSummary.count(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      devices: { total: totalDevices, paired: pairedDevices },
      sync: { total: totalSyncJobs, pending: pendingSyncJobs, failed: failedSyncJobs },
      data: { total: totalDataRecords },
      ai: { total: totalAiRequests, today: todayAiRequests },
      sessions: { total: totalSessionSummaries },
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers(page = 1, limit = 20) {
    limit = Math.min(limit, 100);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, name: true, role: true,
          status: true, lastLoginAt: true, createdAt: true,
          _count: { select: { devices: true, coreData: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listDevices(page = 1, limit = 20) {
    limit = Math.min(limit, 100);
    const [items, total] = await Promise.all([
      this.prisma.device.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, deviceName: true, deviceSerial: true,
          pairingStatus: true, status: true, firmwareVersion: true,
          lastSeenAt: true, createdAt: true,
        },
      }),
      this.prisma.device.count(),
    ]);
    return { data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listSyncJobs(page = 1, limit = 20, status?: string) {
    limit = Math.min(limit, 100);
    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.syncJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.syncJob.count({ where }),
    ]);
    return { data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async disableDevice(deviceId: string, adminId: string) {
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: 'DISABLED' },
    });

    await this.audit.log({
      action: 'ADMIN_DEVICE_DISABLED',
      actorType: 'USER',
      actorId: adminId,
      targetType: 'Device',
      targetId: deviceId,
    });

    this.logger.warn(`Device ${deviceId} disabled by admin ${adminId}`);

    return { message: 'Device disabled', deviceId: device.id };
  }

  /**
   * Re-enable a previously disabled device.
   */
  async enableDevice(deviceId: string, adminId: string) {
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: 'ACTIVE' },
    });

    await this.audit.log({
      action: 'ADMIN_DEVICE_ENABLED',
      actorType: 'USER',
      actorId: adminId,
      targetType: 'Device',
      targetId: deviceId,
    });

    this.logger.log(`Device ${deviceId} enabled by admin ${adminId}`);

    return { message: 'Device enabled', deviceId: device.id };
  }

  /**
   * Update user role (ADMIN/USER). Only SUPER_ADMIN can change roles.
   */
  async updateUserRole(userId: string, role: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
    });

    await this.audit.log({
      action: 'ADMIN_ROLE_CHANGED',
      actorType: 'USER',
      actorId: adminId,
      targetType: 'User',
      targetId: userId,
      metadata: { oldRole: user.role, newRole: role },
    });

    this.logger.warn(`User ${userId} role changed to ${role} by admin ${adminId}`);

    return { message: 'Role updated', userId, role: updated.role };
  }

  /**
   * Update user status (ACTIVE/SUSPENDED).
   */
  async updateUserStatus(userId: string, status: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
    });

    await this.audit.log({
      action: 'ADMIN_STATUS_CHANGED',
      actorType: 'USER',
      actorId: adminId,
      targetType: 'User',
      targetId: userId,
      metadata: { oldStatus: user.status, newStatus: status },
    });

    this.logger.warn(`User ${userId} status changed to ${status} by admin ${adminId}`);

    return { message: 'Status updated', userId, status: updated.status };
  }

  /**
   * List session summaries (admin view).
   */
  async listSessionSummaries(page = 1, limit = 20) {
    limit = Math.min(limit, 100);
    const [items, total] = await Promise.all([
      this.prisma.sessionSummary.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          deviceId: true,
          userId: true,
          sessionStart: true,
          sessionEnd: true,
          summary: true,
          dataPointCount: true,
          alerts: true,
          syncedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.sessionSummary.count(),
    ]);
    return { data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
