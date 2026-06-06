import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import * as bcrypt from 'bcrypt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    // Implement refresh token strategy for authentication
    constructor(private configService: ConfigService, private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') ?? "defaultRefreshSecret1234",
            signOptions: { expiresIn: Number(configService.get<number>('JWT_REFRESH_EXPIRES_IN', 86400)) },
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: { sub: string; email: string }) {
        // Validate the user based on the JWT payload and ensure the refresh token is valid
        console.log('Validating refresh token for user:', payload.email);
        console.log('Received refresh token:', req.headers.authorization);
        const authHeader = req.headers.authorization;
        if(!authHeader) {
            console.error('Authorization header missing in request');
            throw new UnauthorizedException('Authorization header missing');
        }
        const refreshToken = authHeader.replace('Bearer ', '').trim();
        if (!refreshToken) {
            console.error('Refresh token missing in request');
            throw new UnauthorizedException('Refresh token missing');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                updatedAt: true,
                createdAt: true,
                password: false,
                refreshToken: true
            },
        });

        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!refreshTokenMatches) {
            console.error('Refresh token does not match stored token for user:', payload.email);
            throw new UnauthorizedException('Invalid refresh token');
        }
        return user; // This will be attached to the request object as req.user
    }
}
