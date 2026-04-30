import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/roles';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats (includes AI & session counts)' })
  async dashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers(page, limit);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all devices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listDevices(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listDevices(page, limit);
  }

  @Get('sync-jobs')
  @ApiOperation({ summary: 'List sync jobs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listSyncJobs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listSyncJobs(page, limit, status);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorType', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async queryLogs(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('actorId') actorId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.query({ action, actorType, actorId, page, limit });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List IoT session summaries' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listSessionSummaries(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listSessionSummaries(page, limit);
  }

  // ─── Device Management ───────────────────────────────────

  @Post('devices/:id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a device' })
  async disableDevice(
    @Param('id') deviceId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.disableDevice(deviceId, adminId);
  }

  @Post('devices/:id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enable a disabled device' })
  async enableDevice(
    @Param('id') deviceId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.enableDevice(deviceId, adminId);
  }

  // ─── User Management ────────────────────────────────────

  @Patch('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user role (SUPER_ADMIN only)' })
  @ApiBody({ schema: { properties: { role: { type: 'string', enum: ['USER', 'ADMIN'] } } } })
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateUserRole(userId, role, adminId);
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user status (ACTIVE/SUSPENDED)' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] } } } })
  async updateUserStatus(
    @Param('id') userId: string,
    @Body('status') status: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateUserStatus(userId, status, adminId);
  }
}
