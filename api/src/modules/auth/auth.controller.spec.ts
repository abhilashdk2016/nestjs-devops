import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RefreshTokenGaurd } from './guards/refresh-token.gaurd';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';
import { AuthResponseDTO } from './dto/auth-response.dto';

const mockAuthResponse: AuthResponseDTO = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    id: 'user-uuid-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER' as any,
  },
};

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideGuard(JwtAuthGaurd)
      .useValue({ canActivate: () => true })
      .overrideGuard(RefreshTokenGaurd)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto: RegisterDTO = {
      email: 'test@example.com',
      password: 'P@ssw0rd1',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should call authService.register with the DTO and return the result', async () => {
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should propagate exceptions thrown by authService.register', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Conflict'));

      await expect(controller.register(registerDto)).rejects.toThrow('Conflict');
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto: LoginDTO = {
      email: 'test@example.com',
      password: 'P@ssw0rd1',
    };

    it('should call authService.login with the DTO and return the result', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should propagate exceptions thrown by authService.login', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Unauthorized'));

      await expect(controller.login(loginDto)).rejects.toThrow('Unauthorized');
    });

    it('should return tokens and user on success', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const userId = 'user-uuid-1';

    it('should call authService.refreshTokens with userId and return the result', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(userId);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledTimes(1);
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should propagate exceptions thrown by authService.refreshTokens', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(new Error('Unauthorized'));

      await expect(controller.refresh(userId)).rejects.toThrow('Unauthorized');
    });

    it('should return fresh tokens on success', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(userId);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const userId = 'user-uuid-1';

    it('should call authService.logout with userId and return success message', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(userId);

      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      expect(mockAuthService.logout).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ message: 'Successfully logged out' });
    });

    it('should propagate exceptions thrown by authService.logout', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('DB error'));

      await expect(controller.logout(userId)).rejects.toThrow('DB error');
    });

    it('should always return the same success message shape', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('any-user-id');

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    });
  });
});
