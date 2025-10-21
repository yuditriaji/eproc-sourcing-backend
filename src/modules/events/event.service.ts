import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class EventService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly prisma: PrismaService,
  ) {}

  async emit(eventName: string, data: any): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();

    // Augment with tenant metadata
    let residencyTag: string | undefined = undefined;
    if (tenantId) {
      try {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { residencyTag: true } });
        residencyTag = tenant?.residencyTag;
      } catch {}
    }

    const payload = {
      event: eventName,
      data,
      meta: {
        tenantId,
        residencyTag,
        emittedAt: new Date().toISOString(),
      },
    };

    // Persist to outbox for reliable delivery
    if (tenantId) {
      await this.prisma.outbox.create({
        data: {
          tenantId,
          topic: eventName,
          payload,
          headers: { residencyTag },
        },
      });
    }

    // For now, also log
    console.log(`Event emitted: ${eventName}`, payload);
  }
}
