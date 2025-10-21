import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        username: string;
        firstName?: string;
        lastName?: string;
        role: string;
        abilities?: any;
        department?: string;
        tenantId?: string;
      };
      ability?: any;
      tenantId?: string;
    }
  }
}