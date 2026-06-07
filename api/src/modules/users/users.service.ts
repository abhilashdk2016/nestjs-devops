import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserResponseDTO } from './dto/user-response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prismaService: PrismaService) {}

    async findOne(userId: string): Promise<UserResponseDTO> {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
            select: { 
                id: true, 
                email: true, 
                role: true,
                firstName: true,
                lastName: true,
                createdAt: true,
                updatedAt: true,
                password: false, // Exclude password from the response
            },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findAll(): Promise<UserResponseDTO[]> {
        return this.prismaService.user.findMany({
            select: { 
                id: true, 
                email: true, 
                role: true,
                firstName: true,
                lastName: true,
                createdAt: true,
                updatedAt: true,
                password: false, // Exclude password from the response
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(userId: string, updateData: Partial<UserResponseDTO>): Promise<UserResponseDTO> {
        const existingUser = await this.prismaService.user.findUnique({
            where: { id: userId },
        });
        if (!existingUser) {
            throw new NotFoundException('User not found');
        }
        if(updateData.email && updateData.email !== existingUser.email) {
            const emailExists = await this.prismaService.user.findUnique({
                where: { email: updateData.email },
            });
            if (emailExists) {
                throw new ConflictException('Email already in use');
            }
        }
        const user = await this.prismaService.user.update({
            where: { id: userId },
            data: updateData,
            select: { 
                id: true, 
                email: true, 
                role: true,
                firstName: true,
                lastName: true,
                createdAt: true,
                updatedAt: true,
                password: false, // Exclude password from the response
            },
        });
        return user;
    }

    async changePassword(userId: string, updatePasswordDto: { currentPassword: string; newPassword: string }): Promise<{ message: string}> {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        // Compare the currentPassword with the stored hashed password using bcrypt
        const isPasswordValid = await bcrypt.compare(updatePasswordDto.currentPassword, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Current password is incorrect');
        }
        const isSamePassword = await bcrypt.compare(updatePasswordDto.newPassword, user.password);
        if(isSamePassword) {
            throw new NotFoundException("New password must not be same as existing password")
        }
        // Hash the new password before storing it
        const hashedPassword = await bcrypt.hash(updatePasswordDto.newPassword, 10);
        await this.prismaService.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        return { message: 'Password updated successfully' };
    }

    async remove(userId: string): Promise<{message: string}> {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        await this.prismaService.user.delete({ 
            where : { id: userId }
        });
        return { message: "User deleted succesfully" };
    }
}
