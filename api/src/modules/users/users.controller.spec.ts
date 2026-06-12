import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { UserResponseDTO } from './dto/user-response.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { UpdateUserPasswordDTO } from './dto/update-user-password.dto';

const userResponse: UserResponseDTO = {
  id: 'user-uuid-1',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER' as any,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

const mockUsersService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  changePassword: jest.fn(),
  remove: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(JwtAuthGaurd)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGaurd)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getProfile ───────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should call usersService.findOne with the user id from req and return result', async () => {
      mockUsersService.findOne.mockResolvedValue(userResponse);
      const req = { user: { id: 'user-uuid-1' } } as any;

      const result = await controller.getProfile(req);

      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(userResponse);
    });

    it('should propagate NotFoundException thrown by usersService.findOne', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('User not found'));
      const req = { user: { id: 'ghost-id' } } as any;

      await expect(controller.getProfile(req)).rejects.toThrow('User not found');
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should call usersService.findAll and return the list', async () => {
      const users = [userResponse, { ...userResponse, id: 'user-uuid-2' }];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(users);
    });

    it('should return an empty array when there are no users', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate errors from usersService.findAll', async () => {
      mockUsersService.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll()).rejects.toThrow('DB error');
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should call usersService.findOne with the route param id and return result', async () => {
      mockUsersService.findOne.mockResolvedValue(userResponse);

      const result = await controller.findOne('user-uuid-1');

      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(userResponse);
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('User not found'));

      await expect(controller.findOne('non-existent-id')).rejects.toThrow('User not found');
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    const updateDto: UpdateUserDTO = { firstName: 'Jane' };

    it('should call usersService.update with userId and dto and return updated user', async () => {
      const updated = { ...userResponse, firstName: 'Jane' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.updateProfile('user-uuid-1', updateDto);

      expect(mockUsersService.update).toHaveBeenCalledWith('user-uuid-1', updateDto);
      expect(result).toEqual(updated);
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockUsersService.update.mockRejectedValue(new Error('User not found'));

      await expect(controller.updateProfile('ghost-id', updateDto)).rejects.toThrow('User not found');
    });

    it('should propagate ConflictException when email is already taken', async () => {
      mockUsersService.update.mockRejectedValue(new Error('Email already in use'));

      await expect(
        controller.updateProfile('user-uuid-1', { email: 'taken@example.com' }),
      ).rejects.toThrow('Email already in use');
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const passwordDto: UpdateUserPasswordDTO = {
      currentPassword: 'OldP@ss1',
      newPassword: 'NewP@ss2',
    };

    it('should call usersService.changePassword with userId and dto and return message', async () => {
      mockUsersService.changePassword.mockResolvedValue({ message: 'Password updated successfully' });

      const result = await controller.changePassword('user-uuid-1', passwordDto);

      expect(mockUsersService.changePassword).toHaveBeenCalledWith('user-uuid-1', passwordDto);
      expect(result).toEqual({ message: 'Password updated successfully' });
    });

    it('should propagate BadRequestException when current password is wrong', async () => {
      mockUsersService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

      await expect(controller.changePassword('user-uuid-1', passwordDto)).rejects.toThrow(
        'Current password is incorrect',
      );
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockUsersService.changePassword.mockRejectedValue(new Error('User not found'));

      await expect(controller.changePassword('ghost-id', passwordDto)).rejects.toThrow(
        'User not found',
      );
    });
  });

  // ─── deleteUser (self) ────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('should call usersService.remove with userId from decorator and return message', async () => {
      mockUsersService.remove.mockResolvedValue({ message: 'User deleted succesfully' });

      const result = await controller.deleteUser('user-uuid-1');

      expect(mockUsersService.remove).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ message: 'User deleted succesfully' });
    });

    it('should propagate NotFoundException when user is not found', async () => {
      mockUsersService.remove.mockRejectedValue(new Error('User not found'));

      await expect(controller.deleteUser('ghost-id')).rejects.toThrow('User not found');
    });
  });

  // ─── deleteUserByAdmin ────────────────────────────────────────────────────────

  describe('deleteUserByAdmin', () => {
    it('should call usersService.remove with the route param id and return message', async () => {
      mockUsersService.remove.mockResolvedValue({ message: 'User deleted succesfully' });

      const result = await controller.deleteUserByAdmin('user-uuid-1');

      expect(mockUsersService.remove).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ message: 'User deleted succesfully' });
    });

    it('should propagate NotFoundException when target user does not exist', async () => {
      mockUsersService.remove.mockRejectedValue(new Error('User not found'));

      await expect(controller.deleteUserByAdmin('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should forward the correct user id from the route param', async () => {
      mockUsersService.remove.mockResolvedValue({ message: 'User deleted succesfully' });

      await controller.deleteUserByAdmin('specific-uuid-99');

      expect(mockUsersService.remove).toHaveBeenCalledWith('specific-uuid-99');
    });
  });
});
