import { Injectable, NestMiddleware } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantSlug = (req.params as any)?.tenant as string | undefined;
      if (!tenantSlug) {
        return next();
      }

      // Resolve by subdomain first, fallback to id for backward compatibility
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          OR: [{ subdomain: tenantSlug }, { id: tenantSlug }],
        },
        select: { id: true },
      });

      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      (req as any).tenantId = tenant.id;
      return next();
    } catch (err) {
      return res.status(500).json({ message: "Tenant resolution error" });
    }
  }
}
