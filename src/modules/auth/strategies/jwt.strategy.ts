import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  abilities?: any[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    // Validate the user still exists, belongs to tenant, and is active
    const user = await this.prismaService.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        abilities: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive || !user.isVerified) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if token is blacklisted (you'd implement Redis check here)
    // const isBlacklisted = await this.redisService.get(`blacklist:${payload.jti}`);
    // if (isBlacklisted) {
    //   throw new UnauthorizedException('Token has been revoked');
    // }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      abilities: user.abilities,
      tenantId: payload.tenantId,
    };
  }
}