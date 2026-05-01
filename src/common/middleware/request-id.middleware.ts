import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Injects a unique X-Request-Id into every request for correlation/tracing.
 * If the client sends their own X-Request-Id, it is preserved.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
