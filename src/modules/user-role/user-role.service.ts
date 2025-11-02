import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AssignRolesDto } from "./user-role.dto";

@Injectable()
export class UserRoleService {
  constructor(private prisma: PrismaService) {}

  async assignRoles(
    tenantId: string,
    userId: string,
    dto: AssignRolesDto,
    assignedBy: string,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify all roles exist
    const roles = await this.prisma.roleConfig.findMany({
      where: {
        id: { in: dto.roleIds },
        tenantId,
      },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException("One or more role IDs are invalid");
    }

    // Get existing role assignments
    const existingRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
      },
    });

    const existingRoleIds = existingRoles.map((ur) => ur.roleId);
    const newRoleIds = dto.roleIds.filter((id) => !existingRoleIds.includes(id));

    // Assign new roles
    const assignments = await Promise.all(
      newRoleIds.map((roleId) =>
        this.prisma.userRole.create({
          data: {
            tenantId,
            userId,
            roleId,
            assignedBy,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
          include: {
            roleConfig: true,
          },
        }),
      ),
    );

    return {
      message: `Successfully assigned ${assignments.length} role(s) to user`,
      assignments,
      alreadyAssigned: dto.roleIds.length - assignments.length,
    };
  }

  async getUserRoles(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
      },
      include: {
        roleConfig: {
          select: {
            id: true,
            roleName: true,
            permissions: true,
            description: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    return {
      userId,
      email: user.email,
      username: user.username,
      roles: userRoles,
      totalRoles: userRoles.length,
    };
  }

  async removeRole(tenantId: string, userId: string, roleId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        tenantId,
      },
    });

    if (!userRole) {
      throw new NotFoundException("Role assignment not found");
    }

    await this.prisma.userRole.delete({
      where: { id: userRole.id },
    });

    return { message: "Role removed successfully" };
  }

  async getUserPermissions(tenantId: string, userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: {
        roleConfig: {
          select: {
            roleName: true,
            permissions: true,
            isActive: true,
          },
        },
      },
    });

    // Merge permissions from all active roles
    const mergedPermissions: Record<string, any> = {};

    for (const userRole of userRoles) {
      if (userRole.roleConfig.isActive) {
        const rolePermissions = userRole.roleConfig.permissions as Record<
          string,
          any
        >;

        for (const [key, value] of Object.entries(rolePermissions)) {
          if (!mergedPermissions[key]) {
            mergedPermissions[key] = [];
          }

          if (Array.isArray(value)) {
            mergedPermissions[key] = [
              ...new Set([...mergedPermissions[key], ...value]),
            ];
          } else {
            mergedPermissions[key] = value;
          }
        }
      }
    }

    return {
      userId,
      roles: userRoles.map((ur) => ur.roleConfig.roleName),
      effectivePermissions: mergedPermissions,
    };
  }
}
