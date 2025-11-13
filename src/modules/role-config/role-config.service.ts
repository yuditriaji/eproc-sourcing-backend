import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { CreateRoleConfigDto, UpdateRoleConfigDto } from "./role-config.dto";

@Injectable()
export class RoleConfigService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateRoleConfigDto) {
    // Check if role already exists
    const existing = await this.prisma.rbacConfig.findUnique({
      where: {
        tenantId_roleName: {
          tenantId,
          roleName: dto.roleName,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Role "${dto.roleName}" already exists for this tenant`,
      );
    }

    return this.prisma.rbacConfig.create({
      data: {
        tenantId,
        roleName: dto.roleName,
        permissions: dto.permissions,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(tenantId: string, isActive?: boolean) {
    return this.prisma.rbacConfig.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(tenantId: string, roleId: string) {
    const role = await this.prisma.rbacConfig.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
      include: {
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return role;
  }

  async update(tenantId: string, roleId: string, dto: UpdateRoleConfigDto) {
    const role = await this.prisma.rbacConfig.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return this.prisma.rbacConfig.update({
      where: { id: roleId },
      data: {
        permissions: dto.permissions,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
  }

  async delete(tenantId: string, roleId: string) {
    const role = await this.prisma.rbacConfig.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    // Check if role is assigned to users
    const assignedCount = await this.prisma.userRbacRole.count({
      where: {
        rbacRoleId: roleId,
        tenantId,
      },
    });

    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot delete role. It is assigned to ${assignedCount} user(s)`,
      );
    }

    return this.prisma.rbacConfig.delete({
      where: { id: roleId },
    });
  }
}
