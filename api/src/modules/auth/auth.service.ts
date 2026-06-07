import { PrismaService } from '@/prisma/prisma.service';
import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AuthResponseDTO } from './dto/auth-response.dto';
import { RegisterDTO } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { LoginDTO } from './dto/login.dto';

@Injectable()
export class AuthService {
    private readonly SALT_ROUNDS = 12;
    constructor(private prisma: PrismaService, private jwtService: JwtService) {}

    async register(RegisterDTO: RegisterDTO): Promise<AuthResponseDTO> {
        // Check if user already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: RegisterDTO.email },
        });
        if (existingUser) {
            throw new ConflictException('Email is already in use');
        }

        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(RegisterDTO.password, this.SALT_ROUNDS);

            // Create the user
            const user = await this.prisma.user.create({
                data: {
                    email: RegisterDTO.email,
                    password: hashedPassword,
                    firstName: RegisterDTO.firstName,
                    lastName: RegisterDTO.lastName,
                },
                select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    id: true,
                    password: false
                }
            });

            // Generate tokens
            const accessToken = await this.generateAccessToken(user.id, user.email);
            const refreshToken = await this.generateRefreshToken(user.id, user.email);
            await this.updateRefreshToken(user.id, refreshToken);
            return {
                accessToken,
                refreshToken,
                user
            };
        } catch(error) {
            console.error('Error during registration:', error);
            throw new InternalServerErrorException('Registration failed');
        }
    }

    private async generateAccessToken(userId: string, email: string): Promise<string> {
        // Implement JWT access token generation
        const payload = { sub: userId, email };
        const accessToken = await this.jwtService.signAsync(payload, {
            expiresIn: '15m', // Access token expires in 15 minutes
        });
        return accessToken;
    }

    private async generateRefreshToken(userId: string, email: string): Promise<string> {
        // Implement JWT refresh token generation
        const payload = { sub: userId, email };
        const refreshId = randomBytes(16).toString('hex'); // Generate a random string for refresh token ID
        payload['refreshId'] = refreshId; // Add refresh ID to the payload for tracking
        const refreshToken = await this.jwtService.signAsync(payload, {
            expiresIn: '7d', // Refresh token expires in 7 days
        });
        return refreshToken;
    }

    private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
        // Store the refresh token in the database for the user
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken },
        });
    }

    // Refresh access tokens
    async refreshTokens(userId: string): Promise<AuthResponseDTO> {
        // Find the user by ID
        console.log(userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                id: true,
                refreshToken: true
            }
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Generate new tokens
        const accessToken = await this.generateAccessToken(user.id, user.email);
        const refreshToken = await this.generateRefreshToken(user.id, user.email);
        await this.updateRefreshToken(user.id, refreshToken);

        return {
            accessToken,
            refreshToken,
            user
        };
    }

    //Logout
    async logout(userId: string): Promise<void> {
        // Invalidate the refresh token by removing it from the database
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
    }

    //Login
    async login(LoginDTO: LoginDTO): Promise<AuthResponseDTO> {
        // Find the user by email
        const user = await this.prisma.user.findUnique({
            where: { email: LoginDTO.email },
            select: {
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                id: true,
                password: true
            }
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(LoginDTO.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens
        const accessToken = await this.generateAccessToken(user.id, user.email);
        const refreshToken = await this.generateRefreshToken(user.id, user.email);
        await this.updateRefreshToken(user.id, refreshToken);

        // Return the authentication response
        return {
            accessToken,
            refreshToken,
            user: {
                email  : user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                id: user.id
            }
        };
    }
}
