import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const h = req.headers['x-tenant-id'];
  req.tenantId = (typeof h === 'string' && h.trim().length > 0) ? h.trim() : 'default';
  next();
}
