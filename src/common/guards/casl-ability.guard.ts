import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AbilityFactory,
  Action,
  Subjects,
} from "../../modules/auth/abilities/ability.factory";

export interface RequiredRule {
  action: Action;
  subject: Subjects;
  field?: string;
}

@Injectable()
export class CaslAbilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules =
      this.reflector.get<RequiredRule[]>("ability", context.getHandler()) ||
      this.reflector.get<RequiredRule[]>("ability", context.getClass());

    if (!rules) {
      return true; // No abilities required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Create ability for user
    const ability = this.abilityFactory.createForUser({
      id: user.userId,
      role: user.role,
      department: user.department,
      abilities: user.abilities,
    });

    // Check each required rule
    for (const rule of rules) {
      const isAllowed = ability.can(rule.action, rule.subject);

      if (!isAllowed) {
        throw new ForbiddenException(
          `Access denied. Cannot ${rule.action} ${rule.subject}`,
        );
      }
    }

    // Store ability in request for later use
    request.ability = ability;
    return true;
  }
}
