jest.mock('bcrypt');
import * as bcrypt from 'bcrypt';

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const baseUser = {
  id: 'user-uuid-1',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  password: 'hashed-password',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

const userResponse = {
  id: baseUser.id,
  email: baseUser.email,
  firstName: baseUser.firstName,
  lastName: baseUser.lastName,
  role: baseUser.role,
  createdAt: baseUser.createdAt,
  updatedAt: baseUser.updatedAt,
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ─── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(userResponse);

      const result = await service.findOne(baseUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: baseUser.id } }),
      );
      expect(result).toEqual(userResponse);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should exclude the password field from the select', async () => {
      prisma.user.findUnique.mockResolvedValue(userResponse);

      await service.findOne(baseUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ password: false }),
        }),
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [userResponse, { ...userResponse, id: 'user-uuid-2', email: 'jane@example.com' }];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result).toEqual(users);
    });

    it('should return an empty array when there are no users', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should order results by createdAt descending', async () => {
      prisma.user.findMany.mockResolvedValue([userResponse]);

      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateData = { firstName: 'Jane' };
    const updatedUser = { ...userResponse, firstName: 'Jane' };

    it('should update and return the user when found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(baseUser); // existing user check
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(baseUser.id, updateData);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: updateData,
        }),
      );
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateData)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateData)).rejects.toThrow('User not found');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the new email is already taken by another user', async () => {
      const takenUser = { ...baseUser, id: 'other-user-id' };
      prisma.user.findUnique
        .mockResolvedValueOnce(baseUser)   // 1st call: existing user
        .mockResolvedValueOnce(takenUser)  // 1st call: email taken
        .mockResolvedValueOnce(baseUser)   // 2nd call: existing user
        .mockResolvedValueOnce(takenUser); // 2nd call: email taken

      await expect(
        service.update(baseUser.id, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.update(baseUser.id, { email: 'taken@example.com' }),
      ).rejects.toThrow('Email already in use');
    });

    it('should skip the email-uniqueness check when email is unchanged', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(baseUser);
      prisma.user.update.mockResolvedValue(userResponse);

      await service.update(baseUser.id, { email: baseUser.email });

      // findUnique should only be called once (existence check) — not again for email
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const passwordDto = {
      currentPassword: 'OldP@ss1',
      newPassword: 'NewP@ss1',
    };

    it('should update password and return success message', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)  // current password valid
        .mockResolvedValueOnce(false); // new password is different
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(baseUser);

      const result = await service.changePassword(baseUser.id, passwordDto);

      expect(result).toEqual({ message: 'Password updated successfully' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { password: 'new-hashed-password' },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.changePassword('non-existent-id', passwordDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.changePassword('non-existent-id', passwordDto)).rejects.toThrow(
        'User not found',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(baseUser.id, passwordDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.changePassword(baseUser.id, passwordDto)).rejects.toThrow(
        'Current password is incorrect',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when new password is the same as current', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)  // 1st call: current password matches
        .mockResolvedValueOnce(true)  // 1st call: new == current
        .mockResolvedValueOnce(true)  // 2nd call: current password matches
        .mockResolvedValueOnce(true); // 2nd call: new == current

      await expect(
        service.changePassword(baseUser.id, { currentPassword: 'Same@Pass1', newPassword: 'Same@Pass1' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.changePassword(baseUser.id, { currentPassword: 'Same@Pass1', newPassword: 'Same@Pass1' }),
      ).rejects.toThrow('New password must not be same as existing password');
    });

    it('should hash the new password before storing it', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(baseUser);

      await service.changePassword(baseUser.id, passwordDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(passwordDto.newPassword, 10);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the user and return success message', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.delete.mockResolvedValue(baseUser);

      const result = await service.remove(baseUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
      expect(result).toEqual({ message: 'User deleted succesfully' });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent-id')).rejects.toThrow('User not found');
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('should not call delete when the user lookup fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.remove('ghost-id');
      } catch {
        // expected
      }

      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
