import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  tenantId?: string;
}

@Injectable()
export class TenantContext {
  private als = new AsyncLocalStorage<TenantStore>();

  runWithTenant<T>(tenantId: string | undefined, fn: () => T): T {
    return this.als.run({ tenantId }, fn);
  }

  getTenantId(): string | undefined {
    const store = this.als.getStore();
    return store?.tenantId;
  }
}