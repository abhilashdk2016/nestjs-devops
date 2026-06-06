import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    // Implement JWT strategy for authentication
    constructor(private prismaService: PrismaService, private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
    }

    async validate(payload: { sub: string; email: string }) {
        // Validate the user based on the JWT payload
        const user = await this.prismaService.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                updatedAt: true,
                createdAt: true,
                password: false
            },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid token');
        }
        return user; // This will be attached to the request object as req.user
    }
}