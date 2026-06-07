import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { UsersService } from './users.service';
import { UserResponseDTO } from './dto/user-response.dto';
import { Req } from '@nestjs/common';
import type { RequestWithUser } from '@/common/interfaces/request-with-user.interface';
import { Roles } from '@/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { UpdateUserDTO } from './dto/update-user.dto';
import { Http2ServerRequest } from 'http2';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { UpdateUserPasswordDTO } from './dto/update-user-password.dto';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGaurd, RolesGaurd)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // Get current user profile
    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile retrieved successfully.', type: UserResponseDTO })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@Req() req: RequestWithUser): Promise<UserResponseDTO> {
        return this.usersService.findOne(req.user.id);
    }

    // Get all user - for admin
    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'List of all users', type: [UserResponseDTO] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async findAll(): Promise<UserResponseDTO[]> {
        return this.usersService.findAll();
    }

    // Get user by ID - for admin
    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({ status: 200, description: 'User retrieved successfully.', type: UserResponseDTO })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async findOne(@Param('id') userId: string): Promise<UserResponseDTO> {
        return this.usersService.findOne(userId);
    }

    // Update current user profile
    @Patch('me')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiBody({ description: 'Data for updating user profile', type: UpdateUserDTO })
    @ApiResponse({ status: 200, description: 'User profile updated successfully.', type: UserResponseDTO })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async updateProfile(@GetUser('id') userId: string, @Body() updateUserDto: UpdateUserDTO   ): Promise<UserResponseDTO> {
        // Implementation for updating user profile will go here
        return this.usersService.update(userId, updateUserDto);
    }

    // Change current user password
    @Patch('me/password')
    @HttpCode(HttpStatus.OK)
    @Roles(Role.USER, Role.ADMIN)
    @ApiBody({ description: 'Data for changing user password', type: UpdateUserPasswordDTO })
    @ApiOperation({ summary: 'Change current user password' })
    @ApiResponse({ status: 200, description: 'User password updated successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async changePassword(@GetUser('id') userId: string, @Body() updatePasswordDto: UpdateUserPasswordDTO): Promise<{ message: string}> {
        return this.usersService.changePassword(userId, updatePasswordDto);
    }

    @Delete("me")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Delete current user account"})
    @ApiResponse({ status: 200, description: 'User account deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deleteUser(@GetUser('id') userId: string): Promise<{ message: string}> {
        return this.usersService.remove(userId);
    }

    @Delete(":id")
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Delete current user account by admin"})
    @ApiResponse({ status: 200, description: 'User account deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deleteUserByAdmin(@Param('id') userId: string): Promise<{ message: string}> {
        return this.usersService.remove(userId);
    }
}
