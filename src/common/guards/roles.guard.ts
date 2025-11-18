import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      "roles",
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException("User role not found");
    }

    // Check both enum role (user.role) and RBAC roles (user.rbacRoles)
    // Case-insensitive comparison to handle both "ADMIN" (enum) and "Admin" (RBAC)
    const requiredRolesLower = requiredRoles.map((r) => r.toLowerCase());
    const hasEnumRole = requiredRolesLower.includes(user.role.toLowerCase());
    const hasRbacRole = user.rbacRoles?.some((r: string) =>
      requiredRolesLower.includes(r.toLowerCase()),
    ) ?? false;

    if (!hasEnumRole && !hasRbacRole) {
      const userRoles = [user.role, ...(user.rbacRoles || [])].join(", ");
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(", ")}. Your roles: ${userRoles}`,
      );
    }

    return true;
  }
}
