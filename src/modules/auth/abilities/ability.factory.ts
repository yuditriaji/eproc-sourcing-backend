import { Ability, AbilityBuilder, AbilityClass, ExtractSubjectType, InferSubjects } from '@casl/ability';
import { Injectable } from '@nestjs/common';

// Define the subjects for CASL
export type Subjects = InferSubjects<typeof User | typeof Tender | typeof Bid | typeof AuditLog | 'all'>;

// Define actions
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Submit = 'submit',
  Approve = 'approve',
  Score = 'score',
  Award = 'award',
}

// Define subject types
class User {
  id: string;
  role: string;
  department?: string;
}

class Tender {
  id: string;
  creatorId: string;
  department?: string;
  status: string;
}

class Bid {
  id: string;
  vendorId: string;
  tenderId: string;
  status: string;
}

class AuditLog {
  id: string;
  userId?: string;
}

export type AppAbility = Ability<[Action, Subjects]>;

@Injectable()
export class AbilityFactory {
  createForUser(user: any): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );

    // Define abilities based on user role
    switch (user.role) {
      case 'ADMIN':
        // Admin can manage everything
        can(Action.Manage, 'all');
        break;

      case 'USER':
        // Users can read all tenders
        can(Action.Read, Tender);
        
        // Users can create tenders for their department
        can(Action.Create, Tender);
        can(Action.Update, Tender);
        can(Action.Delete, Tender);
        
        // Users can score bids
        can(Action.Score, Bid);
        
        // Users can read bids
        can(Action.Read, Bid);
        
        // Users can approve tenders they created
        can(Action.Approve, Tender);
        
        // Users can read their own profile
        can(Action.Read, User);
        can(Action.Update, User);
        
        // Users can read audit logs
        can(Action.Read, AuditLog);
        
        break;

      case 'VENDOR':
        // Vendors can read published tenders only
        can(Action.Read, Tender);
        
        // Vendors can create and manage their own bids
        can(Action.Create, Bid);
        can(Action.Read, Bid);
        can(Action.Update, Bid);
        can(Action.Submit, Bid);
        
        // Vendors can read their own profile
        can(Action.Read, User);
        can(Action.Update, User);
        
        // Vendors can read audit logs
        can(Action.Read, AuditLog);
        
        // Vendors cannot create tenders or score bids
        cannot(Action.Create, Tender);
        cannot(Action.Score, Bid);
        cannot(Action.Approve, Tender);
        
        break;

      default:
        // No permissions for unknown roles
        break;
    }

    return build({
      detectSubjectType: (item) => 
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  // Helper method to create abilities from user abilities JSON field
  createFromUserAbilities(user: any): AppAbility {
    const { can, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );

    // If user has custom abilities defined
    if (user.abilities && Array.isArray(user.abilities)) {
      user.abilities.forEach((ability: any) => {
        if (ability.actions && ability.subjects) {
          const actions = Array.isArray(ability.actions) ? ability.actions : [ability.actions];
          const subjects = Array.isArray(ability.subjects) ? ability.subjects : [ability.subjects];
          
          actions.forEach((action: Action) => {
            subjects.forEach((subject: any) => {
              if (ability.conditions) {
                can(action, subject, ability.conditions);
              } else {
                can(action, subject);
              }
            });
          });
        }
      });
    } else {
      // Fallback to role-based abilities
      return this.createForUser(user);
    }

    return build({
      detectSubjectType: (item) => 
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}