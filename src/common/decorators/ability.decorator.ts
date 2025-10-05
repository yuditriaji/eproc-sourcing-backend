import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../../modules/auth/abilities/ability.factory';

export interface RequiredRule {
  action: Action;
  subject: Subjects;
  field?: string;
}

export const ABILITY_KEY = 'ability';
export const CheckAbilities = (...requirements: RequiredRule[]) => 
  SetMetadata(ABILITY_KEY, requirements);

// Helper function to create ability requirements
export const AbilityRequirement = (action: Action, subject: Subjects, field?: string): RequiredRule => ({
  action,
  subject,
  field
});