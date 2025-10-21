const { TenantContext } = require('../dist/common/tenant/tenant-context');
const { EventService } = require('../dist/modules/events/event.service');

describe('EventService', () => {
  it('persists to outbox with tenant metadata', async () => {
    const tenantContext = new TenantContext();
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ residencyTag: 'us' }) },
      outbox: { create: jest.fn().mockResolvedValue({ id: '1' }) },
    };

    const svc = new EventService(tenantContext, prisma);
    await tenantContext.runWithTenant('t1', async () => {
      await svc.emit('test.event', { foo: 'bar' });
    });

    expect(prisma.outbox.create).toHaveBeenCalled();
    const arg = prisma.outbox.create.mock.calls[0][0];
    expect(arg.data.tenantId).toBe('t1');
    expect(arg.data.headers.residencyTag).toBe('us');
  });
});
