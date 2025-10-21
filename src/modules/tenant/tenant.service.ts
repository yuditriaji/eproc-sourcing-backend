import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionTenant(input: {
    name: string;
    subdomain: string;
    config?: any;
    admin: { email: string; username?: string; password: string; firstName?: string; lastName?: string };
  }) {
    const tenant = await this.prisma.tenant.create({
      data: {
        name: input.name,
        subdomain: input.subdomain,
        residencyTag: 'us',
        config: input.config ?? null,
      },
      select: { id: true, name: true, subdomain: true },
    });

    const saltRounds = 12;
    const hashed = await bcrypt.hash(input.admin.password, saltRounds);

    const adminUser = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: input.admin.email,
        username: input.admin.username ?? input.admin.email.split('@')[0],
        password: hashed,
        firstName: input.admin.firstName ?? 'Tenant',
        lastName: input.admin.lastName ?? 'Admin',
        role: 'ADMIN' as any,
        isActive: true,
        isVerified: true,
        abilities: [
          { actions: ['manage'], subjects: ['all'] },
        ] as any,
      },
      select: { id: true, email: true, username: true, role: true },
    });

    return { tenant, adminUser };
  }
}
