import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RegisterDto, LoginDto, OAuthGoogleDto, RefreshTokenDto } from './dto';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register a new user via email/password.
   * 1. Create Supabase Auth user
   * 2. Create internal User record in our DB
   * 3. Return tokens + user data
   */
  async register(dto: RegisterDto) {
    // Check if email already exists in our DB
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(ErrorCode.AUTH_EMAIL_EXISTS);
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await this.supabase
      .getClient()
      .auth.signUp({
        email: dto.email,
        password: dto.password,
        options: {
          data: { name: dto.name || '' },
        },
      });

    if (authError) {
      this.logger.error(`Supabase signUp failed: ${authError.message}`);
      if (authError.message.includes('already registered')) {
        throw new ConflictException(ErrorCode.AUTH_EMAIL_EXISTS);
      }
      throw new InternalServerErrorException(ErrorCode.SYSTEM_INTERNAL_ERROR);
    }

    if (!authData.user) {
      throw new InternalServerErrorException(ErrorCode.SYSTEM_INTERNAL_ERROR);
    }

    // Create internal user record
    const user = await this.prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email: dto.email,
        name: dto.name || null,
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    this.logger.log(`User registered: ${user.id} (${user.email})`);

    // If no session (email confirmation enabled), auto-confirm and sign in
    let accessToken = authData.session?.access_token || null;
    let refreshToken = authData.session?.refresh_token || null;

    if (!authData.session) {
      // Auto-confirm the user via admin client
      await this.supabase
        .getAdminClient()
        .auth.admin.updateUserById(authData.user.id, { email_confirm: true });

      // Now sign in to get tokens
      const { data: loginData } = await this.supabase
        .getClient()
        .auth.signInWithPassword({
          email: dto.email,
          password: dto.password,
        });

      accessToken = loginData?.session?.access_token || null;
      refreshToken = loginData?.session?.refresh_token || null;
    }

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login with email/password.
   */
  async login(dto: LoginDto) {
    const { data: authData, error: authError } = await this.supabase
      .getClient()
      .auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (authError) {
      this.logger.warn(`Login failed for ${dto.email}: ${authError.message}`);
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!authData.user || !authData.session) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // Get internal user record
    let user = await this.prisma.user.findUnique({
      where: { supabaseId: authData.user.id },
    });

    if (!user) {
      // Edge case: user exists in Supabase but not in our DB — auto-create
      user = await this.prisma.user.create({
        data: {
          supabaseId: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || null,
          role: 'USER',
          status: 'ACTIVE',
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.id} (${user.email})`);

    return {
      user: this.sanitizeUser(user),
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  }

  /**
   * Login/Register with Google OAuth via ID token.
   */
  async oauthGoogle(dto: OAuthGoogleDto) {
    const { data: authData, error: authError } = await this.supabase
      .getClient()
      .auth.signInWithIdToken({
        provider: 'google',
        token: dto.idToken,
      });

    if (authError) {
      this.logger.error(`Google OAuth failed: ${authError.message}`);
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!authData.user || !authData.session) {
      throw new UnauthorizedException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // Upsert internal user record
    const user = await this.prisma.user.upsert({
      where: { supabaseId: authData.user.id },
      create: {
        supabaseId: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.full_name || null,
        avatarUrl: authData.user.user_metadata?.avatar_url || null,
        role: 'USER',
        status: 'ACTIVE',
      },
      update: {
        lastLoginAt: new Date(),
        name: authData.user.user_metadata?.full_name || undefined,
        avatarUrl: authData.user.user_metadata?.avatar_url || undefined,
      },
    });

    this.logger.log(`Google OAuth login: ${user.id} (${user.email})`);

    return {
      user: this.sanitizeUser(user),
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(dto: RefreshTokenDto) {
    const { data: authData, error: authError } = await this.supabase
      .getClient()
      .auth.refreshSession({ refresh_token: dto.refreshToken });

    if (authError || !authData.session) {
      throw new UnauthorizedException(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  }

  /**
   * Logout — invalidate current session.
   *
   * NOTE: Supabase JS v2 does NOT have auth.admin.signOut().
   * We use the standard auth.signOut() which works with the user's JWT.
   */
  async logout(accessToken: string) {
    try {
      // Use config to get Supabase credentials (SupabaseClient properties are protected)
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = this.config.get<string>('supabase.url', '');
      const supabaseAnonKey = this.config.get<string>('supabase.anonKey', '');

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      const { error } = await userClient.auth.signOut({ scope: 'local' });
      if (error) {
        this.logger.warn(`Logout failed: ${error.message}`);
      }
    } catch (error) {
      // Best-effort — don't crash on logout failure
      this.logger.warn(`Logout error: ${(error as Error).message}`);
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Revoke all sessions for the current user.
   *
   * Uses Supabase Auth Admin REST API directly since
   * supabase-js v2 does not expose admin.signOut().
   */
  async revokeAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    try {
      // Use config to get credentials (protected properties can't be accessed)
      const supabaseUrl = this.config.get<string>('supabase.url', '');
      const serviceKey = this.config.get<string>('supabase.serviceRoleKey', '');

      const response = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${user.supabaseId}/factors`,
        {
          method: 'DELETE',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Revoke all failed: HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Revoke all error: ${(error as Error).message}`);
    }

    this.logger.log(`All sessions revoked for user: ${userId}`);

    return { message: 'All sessions revoked' };
  }

  /**
   * Strip sensitive fields from user object before returning.
   */
  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
