import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Transforms all successful responses into the standard API response format.
 * See docs/01-ARCHITECTURE.md — Success Response format.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        // If data already has the expected shape (e.g., health check), pass through
        if (data && data.__raw === true) {
          delete data.__raw;
          return data;
        }

        // Extract pagination if present, but preserve all other fields
        let responseData = data;
        let pagination: ApiResponse<T>['meta']['pagination'] | undefined;

        if (data && data.pagination) {
          pagination = data.pagination;
          // Preserve all fields except 'pagination' itself
          const { pagination: _, data: innerData, ...extraFields } = data;
          // If response has a 'data' key, use it; otherwise use all remaining fields
          responseData =
            innerData !== undefined
              ? Object.keys(extraFields).length > 0
                ? { ...extraFields, data: innerData }
                : innerData
              : extraFields;
        }

        return {
          success: true,
          data: responseData,
          meta: {
            requestId: (request as any).requestId || null,
            timestamp: new Date().toISOString(),
            ...(pagination && { pagination }),
          },
        };
      }),
    );
  }
}
