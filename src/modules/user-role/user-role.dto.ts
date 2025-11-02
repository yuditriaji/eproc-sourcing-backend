import { IsString, IsArray, IsOptional, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignRolesDto {
  @ApiProperty({
    example: ["role_id_1", "role_id_2"],
    description: "Array of role IDs to assign to the user",
  })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];

  @ApiProperty({
    example: "2025-07-01T00:00:00Z",
    required: false,
    description: "Optional expiration date for the role assignment",
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class RemoveRoleDto {
  @ApiProperty({
    example: "role_id",
    description: "Role ID to remove from the user",
  })
  @IsString()
  roleId: string;
}
