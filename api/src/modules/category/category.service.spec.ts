import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  category: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const baseCategory = {
  id: 'cat-1',
  name: 'Electronics',
  description: 'Electronic devices',
  slug: 'electronics',
  imageUrl: 'https://example.com/electronics.png',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createCategory ──────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('creates a category using the provided slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue(baseCategory);

      const result = await service.createCategory({
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices',
      });

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'electronics' },
      });
      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Electronics', slug: 'electronics' }),
      });
      expect(result.slug).toBe('electronics');
      expect(result.name).toBe('Electronics');
      expect(result.productCount).toBe(0);
    });

    it('auto-generates a slug from name when slug is omitted', async () => {
      const sluggedCategory = { ...baseCategory, name: 'Men Clothing', slug: 'men-clothing' };
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue(sluggedCategory);

      const result = await service.createCategory({ name: 'Men Clothing' });

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'men-clothing' },
      });
      expect(result.slug).toBe('men-clothing');
    });

    it('strips special characters and lowercases the generated slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({ ...baseCategory, slug: 'mens-t-shirts' });

      await service.createCategory({ name: "Men's T-Shirts!" });

      // Only word chars and hyphens survive; apostrophe stripped, space → hyphen
      const calledWith = mockPrisma.category.findUnique.mock.calls[0][0];
      expect(calledWith.where.slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('throws ConflictException when the slug is already in use', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(baseCategory);

      await expect(
        service.createCategory({ name: 'Electronics', slug: 'electronics' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.category.create).not.toHaveBeenCalled();
    });

    it('conflict message includes the conflicting slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(baseCategory);

      await expect(
        service.createCategory({ name: 'Electronics', slug: 'electronics' }),
      ).rejects.toThrow('electronics');
    });

    it('returns category response DTO with productCount of 0 on creation', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue(baseCategory);

      const result = await service.createCategory({ name: 'Electronics', slug: 'electronics' });

      expect(result).toMatchObject({
        id: 'cat-1',
        name: 'Electronics',
        slug: 'electronics',
        isActive: true,
        productCount: 0,
      });
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const categoryWithCount = { ...baseCategory, _count: { products: 3 } };

    it('returns paginated data and meta', async () => {
      mockPrisma.category.count.mockResolvedValue(1);
      mockPrisma.category.findMany.mockResolvedValue([categoryWithCount]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].productCount).toBe(3);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('defaults page to 1 and limit to 10 when not provided', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll({} as any);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('applies isActive filter when provided', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({ isActive: true } as any);

      const where = mockPrisma.category.count.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it('omits isActive from where when not provided', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({} as any);

      const where = mockPrisma.category.count.mock.calls[0][0].where;
      expect(where.isActive).toBeUndefined();
    });

    it('applies OR search filter for name and description', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'electro' } as any);

      const where = mockPrisma.category.count.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR[0].name.contains).toBe('electro');
      expect(where.OR[0].description.contains).toBe('electro');
    });

    it('omits OR clause when search is not provided', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({} as any);

      const where = mockPrisma.category.count.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it('calculates correct skip offset for page 3', async () => {
      mockPrisma.category.count.mockResolvedValue(30);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({ page: 3, limit: 10 });

      const findManyArgs = mockPrisma.category.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20);
      expect(findManyArgs.take).toBe(10);
    });

    it('computes totalPages by ceiling division', async () => {
      mockPrisma.category.count.mockResolvedValue(25);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('requests _count products in findMany include', async () => {
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.findAll({} as any);

      const findManyArgs = mockPrisma.category.findMany.mock.calls[0][0];
      expect(findManyArgs.include._count.select.products).toBe(true);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns formatted category when found', async () => {
      const categoryWithCount = { ...baseCategory, _count: { products: 5 } };
      mockPrisma.category.findUnique.mockResolvedValue(categoryWithCount);

      const result = await service.findOne('cat-1');

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        include: { _count: { select: { products: true } } },
      });
      expect(result.id).toBe('cat-1');
      expect(result.productCount).toBe(5);
    });

    it('throws NotFoundException when category is not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException has a descriptive message', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Specified category not found');
    });
  });

  // ─── findOneBySlug ────────────────────────────────────────────────────────────

  describe('findOneBySlug', () => {
    it('returns formatted category when slug matches', async () => {
      const categoryWithCount = { ...baseCategory, _count: { products: 2 } };
      mockPrisma.category.findUnique.mockResolvedValue(categoryWithCount);

      const result = await service.findOneBySlug('electronics');

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'electronics' },
        include: { _count: { select: { products: true } } },
      });
      expect(result.slug).toBe('electronics');
      expect(result.productCount).toBe(2);
    });

    it('throws NotFoundException when slug does not match any category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOneBySlug('unknown-slug')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException has a descriptive message', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOneBySlug('unknown-slug')).rejects.toThrow('Specified category not found');
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const updatedCategoryWithCount = {
      ...baseCategory,
      name: 'Updated Electronics',
      _count: { products: 1 },
    };

    it('updates and returns the category when slug is unchanged', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(baseCategory);
      mockPrisma.category.update.mockResolvedValue(updatedCategoryWithCount);

      const result = await service.update('cat-1', {
        name: 'Updated Electronics',
        slug: 'electronics',
      });

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: expect.objectContaining({ name: 'Updated Electronics' }),
        include: { _count: { select: { products: true } } },
      });
      expect(result.name).toBe('Updated Electronics');
    });

    it('throws NotFoundException when the category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.category.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new slug is already taken by another category', async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(baseCategory)                          // existing category found
        .mockResolvedValueOnce({ ...baseCategory, id: 'cat-2', slug: 'new-slug' }); // slug is taken

      await expect(
        service.update('cat-1', { slug: 'new-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('skips slug conflict check when no slug provided in dto', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(baseCategory);
      mockPrisma.category.update.mockResolvedValue(updatedCategoryWithCount);

      await service.update('cat-1', { name: 'Updated Name' });

      // findUnique only called once for the existing category check
      expect(mockPrisma.category.findUnique).toHaveBeenCalledTimes(1);
    });

    it('skips slug conflict check when new slug equals existing slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(baseCategory);
      mockPrisma.category.update.mockResolvedValue(updatedCategoryWithCount);

      await service.update('cat-1', { slug: 'electronics' }); // same as baseCategory.slug

      expect(mockPrisma.category.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns properly formatted DTO after update', async () => {
      mockPrisma.category.findUnique.mockResolvedValueOnce(baseCategory);
      mockPrisma.category.update.mockResolvedValue(updatedCategoryWithCount);

      const result = await service.update('cat-1', { name: 'Updated Electronics' });

      expect(result).toMatchObject({
        id: 'cat-1',
        productCount: 1,
      });
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes category and returns success message when no products linked', async () => {
      const categoryWithCount = { ...baseCategory, _count: { products: 0 } };
      mockPrisma.category.findUnique.mockResolvedValue(categoryWithCount);
      mockPrisma.category.delete.mockResolvedValue(baseCategory);

      const result = await service.remove('cat-1');

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
      expect(result.message).toBe('Category deleted succesfully');
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.category.delete).not.toHaveBeenCalled();
    });

    it('NotFoundException message says category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow('Category not found');
    });

    it('throws BadRequestException when category has one or more products', async () => {
      const categoryWithProducts = { ...baseCategory, _count: { products: 3 } };
      mockPrisma.category.findUnique.mockResolvedValue(categoryWithProducts);

      await expect(service.remove('cat-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.category.delete).not.toHaveBeenCalled();
    });

    it('BadRequestException message mentions the product count', async () => {
      const categoryWithProducts = { ...baseCategory, _count: { products: 5 } };
      mockPrisma.category.findUnique.mockResolvedValue(categoryWithProducts);

      await expect(service.remove('cat-1')).rejects.toThrow('5');
    });

    it('findUnique for remove includes _count.products', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('cat-1')).rejects.toThrow(NotFoundException);

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        include: { _count: { select: { products: true } } },
      });
    });
  });
});
