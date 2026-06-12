jest.mock('bcrypt');
import * as bcrypt from 'bcrypt';

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    // Restore signAsync default after clearAllMocks
    mockJwtService.signAsync.mockResolvedValue('mock-token');
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto: RegisterDTO = {
      email: 'test@example.com',
      password: 'P@ssw0rd1',
      firstName: 'John',
      lastName: 'Doe',
    };

    const createdUser = {
      id: 'user-uuid-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    };

    it('should register a new user and return tokens + user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.user.update.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            password: 'hashed-password',
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
          }),
        }),
      );
      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-token');
      expect(result.user).toEqual(createdUser);
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(createdUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email is already in use');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user.create fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockRejectedValue(new Error('DB error'));

      await expect(service.register(registerDto)).rejects.toThrow(InternalServerErrorException);
    });

    it('should store the hashed refresh token in the DB after registration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.user.update.mockResolvedValue(createdUser);

      await service.register(registerDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: createdUser.id },
        data: { refreshToken: 'mock-token' },
      });
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto: LoginDTO = {
      email: 'test@example.com',
      password: 'P@ssw0rd1',
    };

    const dbUser = {
      id: 'user-uuid-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      password: 'hashed-password',
    };

    it('should return tokens and user data on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(dbUser);

      const result = await service.login(loginDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: loginDto.email } }),
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, dbUser.password);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user).toMatchObject({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should update the stored refresh token after successful login', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(dbUser);

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: { refreshToken: 'mock-token' },
      });
    });
  });

  // ─── refreshTokens ────────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const dbUser = {
      id: 'user-uuid-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      refreshToken: 'old-refresh-token',
    };

    it('should return new tokens when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      prisma.user.update.mockResolvedValue(dbUser);

      const result = await service.refreshTokens(dbUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: dbUser.id } }),
      );
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user).toMatchObject({
        id: dbUser.id,
        email: dbUser.email,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('non-existent-id')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should update the refresh token in the DB after generating new tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      prisma.user.update.mockResolvedValue(dbUser);

      await service.refreshTokens(dbUser.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: { refreshToken: 'mock-token' },
      });
    });

    it('should call jwtService.signAsync twice (access + refresh)', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);
      prisma.user.update.mockResolvedValue(dbUser);

      await service.refreshTokens(dbUser.id);

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const userId = 'user-uuid-1';

    it('should set refreshToken to null in the DB', async () => {
      prisma.user.update.mockResolvedValue({ id: userId, refreshToken: null });

      await service.logout(userId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { refreshToken: null },
      });
    });

    it('should resolve without returning a value', async () => {
      prisma.user.update.mockResolvedValue({ id: userId });

      const result = await service.logout(userId);

      expect(result).toBeUndefined();
    });

    it('should propagate DB errors if user.update rejects', async () => {
      prisma.user.update.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.logout(userId)).rejects.toThrow('DB connection lost');
    });
  });
});
