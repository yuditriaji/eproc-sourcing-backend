import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  Get,
  Patch,
  Param,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthGuard } from "@nestjs/passport";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from "class-validator";
import {
  AuthService,
  LoginDto as ILoginDto,
  RegisterDto as IRegisterDto,
} from "./auth.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TenantService } from "../tenant/tenant.service";

export class LoginDto implements ILoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterDto implements IRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

@ApiTags("Authentication")
@Controller(":tenant/auth")
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantContext: TenantContext,
    private readonly tenantService: TenantService,
  ) {}

  @Post("login")
  @ApiOperation({
    summary: "User login",
    description:
      "Authenticate user with email and password, returns JWT tokens with role-based claims",
  })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    schema: {
      example: {
        accessToken: "jwt-access-token",
        user: {
          id: "user-id",
          email: "user@example.com",
          username: "username",
          role: "USER",
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 403, description: "Account inactive or not verified" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }
    const result = await this.authService.login(
      loginDto,
      ipAddress,
      userAgent,
      tenantId,
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post("register")
  @ApiOperation({
    summary: "User registration",
    description:
      "Register new user account. Vendors require manual verification.",
  })
  @ApiResponse({
    status: 201,
    description: "Registration successful",
  })
  @ApiResponse({
    status: 400,
    description: "User already exists or validation error",
  })
  @ApiResponse({ status: 403, description: "Account requires verification" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute for registration
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }
    const result = await this.authService.register(
      registerDto,
      ipAddress,
      userAgent,
      tenantId,
    );

    // Set refresh token as httpOnly cookie for verified users
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Refresh access token",
    description: "Generate new access token using refresh token",
  })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    schema: {
      example: {
        accessToken: "new-jwt-access-token",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return {
        status: HttpStatus.UNAUTHORIZED,
        message: "Refresh token not found",
      };
    }

    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    const result = await this.authService.refreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    return result;
  }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({
    summary: "User logout",
    description: "Logout user and revoke refresh token",
  })
  @ApiResponse({ status: 200, description: "Logout successful" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req.user as any)?.userId;
    const refreshToken = req.cookies?.refreshToken;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    if (userId && refreshToken) {
      await this.authService.logout(userId, refreshToken, ipAddress, userAgent);
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    return { message: "Logout successful" };
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user profile",
    description: "Get authenticated user profile information",
  })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved",
    schema: {
      example: {
        userId: "user-id",
        email: "user@example.com",
        username: "username",
        role: "USER",
        abilities: [],
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Req() req: Request) {
    return req.user as any;
  }

  @Patch("users/:userId/verify")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Verify user account (Admin only)",
    description: "Verify a user account, typically used for VENDOR accounts that require manual verification",
  })
  @ApiResponse({ status: 200, description: "User verified successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 404, description: "User not found" })
  async verifyUser(
    @Param("userId") userId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    const result = await this.authService.verifyUser(
      userId,
      tenantId,
      (req.user as any)?.userId,
      ipAddress,
      userAgent,
    );

    return result;
  }

  @Get("users")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all registered users (Admin only)",
    description: "Retrieve all registered users in the system",
  })
  @ApiResponse({
    status: 200,
    description: "Users retrieved successfully",
    schema: {
      example: {
        users: [
          {
            id: "user-id",
            email: "user@example.com",
            username: "username",
            firstName: "John",
            lastName: "Doe",
            role: "USER",
            department: "IT",
            isActive: true,
            isVerified: true,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        total: 10,
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async getAllUsers(@Req() req: Request) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    const result = await this.authService.getAllUsers(tenantId);
    return result;
  }

  @Get("roles/config")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiSecurity("JWT")
  @ApiOperation({
    summary: "Get role configuration (Admin only)",
    description: "Retrieve role-based permissions configuration",
  })
  @ApiResponse({ status: 200, description: "Role configuration retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  async getRoleConfig() {
    // This would typically fetch role configurations from database
    return {
      roles: [
        {
          role: "ADMIN",
          permissions: ["*"], // All permissions
          description: "System administrator with full access",
        },
        {
          role: "USER",
          permissions: ["read:tenders", "create:tenders", "score:bids"],
          description: "Internal user who can create tenders and score bids",
        },
        {
          role: "VENDOR",
          permissions: ["read:own", "create:bids", "submit:bids"],
          description: "External vendor who can submit bids",
        },
      ],
    };
  }
}
