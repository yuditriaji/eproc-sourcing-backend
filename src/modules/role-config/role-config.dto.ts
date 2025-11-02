import { IsString, IsOptional, IsBoolean, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateRoleConfigDto {
  @ApiProperty({ example: "PROCUREMENT_MANAGER" })
  @IsString()
  roleName: string;

  @ApiProperty({
    example: {
      tenders: ["create", "read", "update", "approve"],
      vendors: ["read", "evaluate"],
    },
  })
  @IsObject()
  permissions: Record<string, any>;

  @ApiProperty({ example: "Procurement department manager", required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRoleConfigDto {
  @ApiProperty({
    example: {
      tenders: ["create", "read", "update", "approve"],
      vendors: ["read", "evaluate"],
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  permissions?: Record<string, any>;

  @ApiProperty({ example: "Updated description", required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
