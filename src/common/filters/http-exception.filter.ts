import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_MESSAGES } from '../constants/error-messages';
import { ErrorCode } from '../constants/error-codes';

/**
 * Global exception filter that formats ALL errors into a consistent response shape.
 * See docs/01-ARCHITECTURE.md — Error Response format.
 *
 * Includes user-friendly messages in Bahasa Indonesia for farmer-facing apps.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'SYSTEM_INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = this.statusToErrorCode(statusCode);
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        errorCode = resp.error || this.statusToErrorCode(statusCode);

        // Handle class-validator array messages
        if (Array.isArray(message)) {
          message = message.join('; ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    // Look up user-friendly Indonesian message for the error code
    const userMessage =
      ERROR_MESSAGES[errorCode as ErrorCode] ||
      ERROR_MESSAGES[this.statusToErrorCode(statusCode) as ErrorCode] ||
      'Terjadi kesalahan. Coba lagi nanti.';

    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message, // Technical message (for debugging / dev)
        userMessage, // Bahasa Indonesia (for display to farmers)
        statusCode,
      },
      meta: {
        requestId: (request as any).requestId || null,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(statusCode).json(errorResponse);
  }

  private statusToErrorCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'AUTH_UNAUTHORIZED',
      403: 'AUTH_FORBIDDEN',
      404: 'RESOURCE_NOT_FOUND',
      409: 'RESOURCE_CONFLICT',
      410: 'RESOURCE_GONE',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'SYSTEM_INTERNAL_ERROR',
      503: 'SYSTEM_SERVICE_UNAVAILABLE',
    };
    return map[status] || 'SYSTEM_UNKNOWN_ERROR';
  }
}
