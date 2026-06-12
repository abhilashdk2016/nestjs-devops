import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';

const mockCategoryService = {
  createCategory: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneBySlug: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const allowAllGuard = { canActivate: () => true };

const categoryResponse = {
  id: 'cat-1',
  name: 'Electronics',
  description: 'Electronic devices',
  slug: 'electronics',
  imageUrl: 'https://example.com/electronics.png',
  isActive: true,
  productCount: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

const paginatedResponse = {
  data: [categoryResponse],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

describe('CategoryController', () => {
  let controller: CategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: mockCategoryService }],
    })
      .overrideGuard(JwtAuthGaurd)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGaurd)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<CategoryController>(CategoryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── POST / ───────────────────────────────────────────────────────────────────

  describe('createcategory (POST /categories)', () => {
    it('delegates to CategoryService.createCategory and returns the result', async () => {
      mockCategoryService.createCategory.mockResolvedValue(categoryResponse);

      const dto = { name: 'Electronics', slug: 'electronics' };
      const result = await controller.createcategory(dto as any);

      expect(mockCategoryService.createCategory).toHaveBeenCalledWith(dto);
      expect(result).toEqual(categoryResponse);
    });

    it('propagates exceptions thrown by the service', async () => {
      mockCategoryService.createCategory.mockRejectedValue(new Error('Conflict'));

      await expect(controller.createcategory({ name: 'X' } as any)).rejects.toThrow('Conflict');
    });
  });

  // ─── GET / ────────────────────────────────────────────────────────────────────

  describe('findAll (GET /categories)', () => {
    it('delegates to CategoryService.findAll with the query DTO', async () => {
      mockCategoryService.findAll.mockResolvedValue(paginatedResponse);

      const queryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(queryDto as any);

      expect(mockCategoryService.findAll).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(paginatedResponse);
    });

    it('passes isActive and search filters through to service', async () => {
      mockCategoryService.findAll.mockResolvedValue(paginatedResponse);

      const queryDto = { isActive: true, search: 'electro', page: 1, limit: 5 };
      await controller.findAll(queryDto as any);

      expect(mockCategoryService.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────────

  describe('findOne (GET /categories/:id)', () => {
    it('delegates to CategoryService.findOne with the id param', async () => {
      mockCategoryService.findOne.mockResolvedValue(categoryResponse);

      const result = await controller.findOne('cat-1');

      expect(mockCategoryService.findOne).toHaveBeenCalledWith('cat-1');
      expect(result).toEqual(categoryResponse);
    });

    it('propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockCategoryService.findOne.mockRejectedValue(new NotFoundException('Specified category not found'));

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── GET /slug/:slug ──────────────────────────────────────────────────────────

  describe('findOneBySlug (GET /categories/slug/:slug)', () => {
    it('delegates to CategoryService.findOneBySlug with the slug param', async () => {
      mockCategoryService.findOneBySlug.mockResolvedValue(categoryResponse);

      const result = await controller.findOneBySlug('electronics');

      expect(mockCategoryService.findOneBySlug).toHaveBeenCalledWith('electronics');
      expect(result).toEqual(categoryResponse);
    });

    it('propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockCategoryService.findOneBySlug.mockRejectedValue(new NotFoundException('Specified category not found'));

      await expect(controller.findOneBySlug('bad-slug')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── PATCH /:id ───────────────────────────────────────────────────────────────

  describe('update (PATCH /categories/:id)', () => {
    it('delegates to CategoryService.update with id and dto', async () => {
      const updatedCategory = { ...categoryResponse, name: 'Updated Electronics' };
      mockCategoryService.update.mockResolvedValue(updatedCategory);

      const dto = { name: 'Updated Electronics' };
      const result = await controller.update('cat-1', dto as any);

      expect(mockCategoryService.update).toHaveBeenCalledWith('cat-1', dto);
      expect(result.name).toBe('Updated Electronics');
    });

    it('propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockCategoryService.update.mockRejectedValue(new NotFoundException('Specified category not found'));

      await expect(controller.update('nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────

  describe('deleteUserByAdmin (DELETE /categories/:id)', () => {
    it('delegates to CategoryService.remove with the id param', async () => {
      mockCategoryService.remove.mockResolvedValue({ message: 'Category deleted succesfully' });

      const result = await controller.deleteUserByAdmin('cat-1');

      expect(mockCategoryService.remove).toHaveBeenCalledWith('cat-1');
      expect(result.message).toBe('Category deleted succesfully');
    });

    it('propagates BadRequestException when category has products', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockCategoryService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete category with 3 products'),
      );

      await expect(controller.deleteUserByAdmin('cat-1')).rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException when category does not exist', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockCategoryService.remove.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.deleteUserByAdmin('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
