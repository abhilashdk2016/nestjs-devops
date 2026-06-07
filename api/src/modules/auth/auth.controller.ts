import { Controller, Body, UseGuards, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/register.dto';
import { AuthResponseDTO } from './dto/auth-response.dto';
import { RefreshTokenGaurd } from './guards/refresh-token.gaurd';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { LoginDTO } from './dto/login.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // Register
    @Post('register')
    @HttpCode(201)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDTO })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 429, description: 'Too Many Requests' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async register(@Body() RegisterDTO: RegisterDTO): Promise<AuthResponseDTO> {
        return await this.authService.register(RegisterDTO);
    }

    // Refresh access token
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-refresh')
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Access token refreshed successfully', type: AuthResponseDTO })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    @ApiResponse({ status: 429, description: 'Too Many Requests' })
    @UseGuards(RefreshTokenGaurd)
    async refresh(@GetUser('id') userId: string): Promise<AuthResponseDTO> {
        return this.authService.refreshTokens(userId);
    }

    // Logout user and invalidate refresh token
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user and invalidate refresh token' })
    @ApiResponse({ status: 200, description: 'User logged out successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    @ApiResponse({ status: 429, description: 'Too Many Requests' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGaurd)
    async logout(@GetUser('id') userId: string): Promise<{message: string}> {
        await this.authService.logout(userId);
        return { message: 'Successfully logged out' };
    }

    // Login
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'User logged in successfully', type: AuthResponseDTO })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    @ApiResponse({ status: 429, description: 'Too Many Requests' })
    async login(@Body() LoginDTO: LoginDTO): Promise<AuthResponseDTO> {
        // Invalidate the refresh token by removing it from the database
        return await this.authService.login(LoginDTO);
    }
}