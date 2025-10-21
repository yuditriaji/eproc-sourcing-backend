const { TenantContext } = require('../dist/common/tenant/tenant-context');

describe('TenantContext', () => {
  it('stores tenant id per async context', async () => {
    const ctx = new TenantContext();
    let seen;
    await Promise.all([
      ctx.runWithTenant('a', async () => {
        await new Promise(r => setTimeout(r, 5));
        seen = ctx.getTenantId();
        expect(seen).toBe('a');
      }),
      ctx.runWithTenant('b', async () => {
        await new Promise(r => setTimeout(r, 1));
        expect(ctx.getTenantId()).toBe('b');
      }),
    ]);
  });
});
