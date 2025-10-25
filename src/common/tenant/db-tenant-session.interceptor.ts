import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, from } from "rxjs";
import { TenantContext } from "./tenant-context";
import { PrismaService } from "../../database/prisma/prisma.service";
import { mergeMap } from "rxjs/operators";

@Injectable()
export class DbTenantSessionInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      return next.handle();
    }

    // Best-effort: set Postgres session variable for RLS policies.
    // Note: Without wrapping requests in a single transaction, connection reuse is not guaranteed.
    // For stricter guarantees, migrate to an interceptor that uses interactive transactions.
    return from(
      this.prisma.$executeRawUnsafe(
        `select set_config('app.tenant_id', $1, true)`,
        tenantId,
      ),
    ).pipe(mergeMap(() => next.handle()));
  }
}
