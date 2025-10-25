import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ForbiddenException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { TenantContext } from "./tenant-context";

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const resolvedTenantId = (req as any).tenantId as string | undefined; // set by TenantMiddleware
    const userTenantId = req.user?.tenantId as string | undefined;

    // If both exist and mismatch → forbid
    if (resolvedTenantId && userTenantId && resolvedTenantId !== userTenantId) {
      throw new ForbiddenException("Tenant mismatch");
    }

    const tenantId = resolvedTenantId ?? userTenantId;
    return this.tenantContext.runWithTenant(tenantId, () => next.handle());
  }
}
