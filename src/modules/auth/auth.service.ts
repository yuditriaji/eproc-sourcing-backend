import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    role: string;
    abilities?: any;
    tenantId: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prismaService: PrismaService,
    private auditService: AuditService,
  ) {}

  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
    tenantId?: string,
  ): Promise<AuthResult> {
    const { email, password } = loginDto;

    // Find user with password
    if (!tenantId) {
      throw new BadRequestException("Missing tenant id");
    }

    const user = await this.prismaService.user.findFirst({
      where: { email, tenantId },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        abilities: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user) {
      // Log failed login attempt
      await this.auditService.log({
        action: "LOGIN",
        targetType: "User",
        targetId: null,
        ipAddress,
        userAgent,
        metadata: { email, reason: "user_not_found" },
      });

      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      await this.auditService.log({
        userId: user.id,
        action: "LOGIN",
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: "account_inactive" },
      });

      throw new ForbiddenException("Account is inactive");
    }

    if (!user.isVerified) {
      await this.auditService.log({
        userId: user.id,
        action: "LOGIN",
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: "account_not_verified" },
      });

      throw new ForbiddenException("Account is not verified");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.auditService.log({
        userId: user.id,
        action: "LOGIN",
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: "invalid_password" },
      });

      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      abilities: user.abilities,
      tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>("JWT_EXPIRY", "15m"),
    });

    const refreshTokenId = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId: refreshTokenId, tenantId },
      {
        secret: this.configService.get<string>("REFRESH_TOKEN_SECRET"),
        expiresIn: this.configService.get<string>("REFRESH_TOKEN_EXPIRY", "7d"),
      },
    );

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prismaService.refreshToken.create({
      data: {
        token: refreshTokenId,
        userId: user.id,
        expiresAt,
        tenantId,
      },
    });

    // Log successful login
    await this.auditService.log({
      userId: user.id,
      action: "LOGIN",
      targetType: "User",
      targetId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        abilities: user.abilities,
        tenantId,
      },
    };
  }

  async register(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent: string,
    tenantId?: string,
  ): Promise<AuthResult> {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      role = "USER",
    } = registerDto;

    // Check if user already exists
    if (!tenantId) {
      throw new BadRequestException("Missing tenant id");
    }

    const existingUser = await this.prismaService.user.findFirst({
      where: {
        tenantId,
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        "User with this email or username already exists",
      );
    }

    // Hash password - use hardcoded value for now since config might be causing issues
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Set default abilities based on role
    let defaultAbilities = [];
    switch (role) {
      case "ADMIN":
        defaultAbilities = [
          {
            actions: ["manage"],
            subjects: ["all"],
          },
        ];
        break;
      case "USER":
        defaultAbilities = [
          {
            actions: ["create", "read", "update"],
            subjects: ["Tender"],
            conditions: { creatorId: "{{userId}}" },
          },
          {
            actions: ["read", "score"],
            subjects: ["Bid"],
          },
        ];
        break;
      case "VENDOR":
        defaultAbilities = [
          {
            actions: ["read"],
            subjects: ["Tender"],
            conditions: { status: "PUBLISHED" },
          },
          {
            actions: ["create", "read", "update"],
            subjects: ["Bid"],
            conditions: { vendorId: "{{userId}}" },
          },
        ];
        break;
    }

    // Create user
    const user = await this.prismaService.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        role: role as any,
        abilities: defaultAbilities,
        isVerified: role !== "VENDOR", // Auto-verify admin and users, vendors need manual verification
        tenantId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        abilities: true,
        isVerified: true,
        tenantId: true,
      },
    });

    // Log user registration
    try {
      await this.auditService.log({
        userId: user.id,
        action: "CREATE",
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error("Failed to log user registration audit:", error);
    }

    if (!user.isVerified) {
      const exception = new ForbiddenException(
        "Account created but requires verification. Please contact administrator.",
      );
      // Add user info to exception response for client to use
      (exception as any).response = {
        statusCode: 403,
        message: "Account created but requires verification. Please contact administrator.",
        error: "Forbidden",
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      throw exception;
    }

    // Generate tokens for verified users
    return this.generateTokensForUser(user, ipAddress, userAgent);
  }

  async verifyUser(
    userId: string,
    tenantId: string,
    adminUserId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ message: string; user: any }> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isVerified) {
      return {
        message: "User is already verified",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          isVerified: user.isVerified,
        },
      };
    }

    // Update user to verified
    const updatedUser = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });

    // Log verification
    try {
      await this.auditService.log({
        userId: adminUserId,
        action: "UPDATE",
        targetType: "User",
        targetId: userId,
        oldValues: { isVerified: false },
        newValues: { isVerified: true },
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error("Failed to log user verification audit:", error);
    }

    return {
      message: "User verified successfully",
      user: updatedUser,
    };
  }

  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("REFRESH_TOKEN_SECRET"),
      });

      // Check if refresh token exists and is not revoked
      const storedToken = (await this.prismaService.refreshToken.findFirst({
        where: {
          token: (payload as any).tokenId,
          tenantId: (payload as any).tenantId,
        },
      })) as any;

      const user = await this.prismaService.user.findFirst({
        where: {
          id: (payload as any).sub,
          tenantId: (payload as any).tenantId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          abilities: true,
          isActive: true,
          isVerified: true,
        },
      });

      if (
        !storedToken ||
        storedToken.isRevoked ||
        storedToken.expiresAt < new Date()
      ) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      if (!user || !user.isActive || !user.isVerified) {
        throw new UnauthorizedException("User account is inactive");
      }

      // Generate new access token
      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        abilities: user.abilities,
        tenantId: (payload as any).tenantId,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get<string>("JWT_EXPIRY", "15m"),
      });

      // Log token refresh
      await this.auditService.log({
        userId: user.id,
        action: "LOGIN",
        targetType: "User",
        targetId: user.id,
        ipAddress,
        userAgent,
      });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(
    userId: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("REFRESH_TOKEN_SECRET"),
      });

      // Revoke refresh token
      await this.prismaService.refreshToken.updateMany({
        where: { token: payload.tokenId },
        data: { isRevoked: true },
      });

      // Log logout
      await this.auditService.log({
        userId,
        action: "LOGOUT",
        targetType: "User",
        targetId: userId,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      // Even if token verification fails, log the logout attempt
      await this.auditService.log({
        userId,
        action: "LOGOUT",
        targetType: "User",
        targetId: userId,
        ipAddress,
        userAgent,
        metadata: { reason: "invalid_token" },
      });
    }
  }

  async getAllUsers(tenantId: string): Promise<{ users: any[]; total: number }> {
    const users = await this.prismaService.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      users,
      total: users.length,
    };
  }

  private async generateTokensForUser(
    user: any,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthResult> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      abilities: user.abilities,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>("JWT_EXPIRY", "15m"),
    });

    const refreshTokenId = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId: refreshTokenId, tenantId: user.tenantId },
      {
        secret: this.configService.get<string>("REFRESH_TOKEN_SECRET"),
        expiresIn: this.configService.get<string>("REFRESH_TOKEN_EXPIRY", "7d"),
      },
    );

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prismaService.refreshToken.create({
      data: {
        token: refreshTokenId,
        userId: user.id,
        expiresAt,
        tenantId: user.tenantId,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        abilities: user.abilities,
        tenantId: user.tenantId,
      },
    };
  }
}
