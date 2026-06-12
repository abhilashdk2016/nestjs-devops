import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ─── Mock Prisma.Decimal ──────────────────────────────────────────────────────
// Define MockDecimal inside the factory so it's available when Jest hoists
// the jest.mock() call above module-level variable initializations.
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  class MockDecimal {
    val: number;
    constructor(v: number) { this.val = v; }
  }
  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      Decimal: MockDecimal,
    },
  };
});

// Re-import Decimal after mocking so tests can use it for instanceof checks
const { Prisma: { Decimal: MockDecimal } } = jest.requireMock('@prisma/client');

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const baseCategory = { id: 'cat-1', name: 'Electronics' };

const baseProduct = {
  id: 'prod-1',
  name: 'Laptop',
  description: 'A high end computing machine',
  price: 999.99,
  stock: 10,
  sku: 'LAPTOP-001',
  imageUrl: 'https://example.com/laptop.png',
  isActive: true,
  categoryId: 'cat-1',
  category: baseCategory,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Laptop',
      price: 999.99,
      stock: 10,
      sku: 'LAPTOP-001',
      categoryId: 'cat-1',
    };

    it('creates a product and returns formatted response', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(baseProduct);

      const result = await service.create(createDto as any);

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { sku: 'LAPTOP-001' },
      });
      expect(mockPrisma.product.create).toHaveBeenCalled();
      expect(result.name).toBe('Laptop');
      expect(result.category).toBe('Electronics');
      expect(typeof result.price).toBe('number');
    });

    it('wraps price in Prisma.Decimal on create', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(baseProduct);

      await service.create(createDto as any);

      const createCall = mockPrisma.product.create.mock.calls[0][0];
      expect(createCall.data.price).toBeInstanceOf(MockDecimal);
      expect((createCall.data.price as any).val).toBe(999.99);
    });

    it('includes category in create call', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(baseProduct);

      await service.create(createDto as any);

      const createCall = mockPrisma.product.create.mock.calls[0][0];
      expect(createCall.include.category).toBe(true);
    });

    it('throws ConflictException when SKU already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('ConflictException message says product already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);

      await expect(service.create(createDto as any)).rejects.toThrow('Product already exists');
    });

    it('formats price as a number in the response', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ ...baseProduct, price: '999.99' });

      const result = await service.create(createDto as any);

      expect(typeof result.price).toBe('number');
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const productWithCategory = { ...baseProduct };

    it('returns paginated products with meta', async () => {
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.product.findMany.mockResolvedValue([productWithCategory]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Laptop');
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('defaults page to 1 and limit to 10 when omitted', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await service.findAll({} as any);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('filters by categoryId when category is provided', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({ category: 'cat-1' } as any);

      const where = mockPrisma.product.count.mock.calls[0][0].where;
      expect(where.categoryId).toBe('cat-1');
    });

    it('omits categoryId filter when category is not provided', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({} as any);

      const where = mockPrisma.product.count.mock.calls[0][0].where;
      expect(where.categoryId).toBeUndefined();
    });

    it('applies isActive filter when provided', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({ isActive: false } as any);

      const where = mockPrisma.product.count.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });

    it('applies OR search filter for name and description', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'laptop' } as any);

      const where = mockPrisma.product.count.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR[0].name.contains).toBe('laptop');
    });

    it('calculates correct skip for page 2', async () => {
      mockPrisma.product.count.mockResolvedValue(20);
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.findAll({ page: 2, limit: 10 });

      const findManyArgs = mockPrisma.product.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(10);
    });

    it('computes totalPages by ceiling', async () => {
      mockPrisma.product.count.mockResolvedValue(21);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns formatted product when found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);

      const result = await service.findOne('prod-1');

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: { category: true },
      });
      expect(result.id).toBe('prod-1');
      expect(result.category).toBe('Electronics');
    });

    it('throws NotFoundException when product is not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException has descriptive message', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow('Specified product not found');
    });
  });

  // ─── findOneBySku ─────────────────────────────────────────────────────────────

  describe('findOneBySku', () => {
    it('returns formatted product when SKU matches', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);

      const result = await service.findOneBySku('LAPTOP-001');

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { sku: 'LAPTOP-001' },
        include: { category: true },
      });
      expect(result.sku).toBe('LAPTOP-001');
    });

    it('throws NotFoundException when SKU does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOneBySku('UNKNOWN-SKU')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException has descriptive message', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOneBySku('UNKNOWN-SKU')).rejects.toThrow('Specified product not found');
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto = { name: 'Updated Laptop', sku: 'LAPTOP-002' };
    const updatedProduct = { ...baseProduct, name: 'Updated Laptop', sku: 'LAPTOP-002' };

    it('updates and returns the formatted product', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(baseProduct);
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      // Use same SKU as existing product so the conflict check is skipped entirely
      const result = await service.update('prod-1', { name: 'Updated Laptop', sku: 'LAPTOP-001' } as any);

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: expect.objectContaining({ name: 'Updated Laptop' }),
        include: { category: true },
      });
      expect(result.name).toBe('Updated Laptop');
    });

    it('wraps price in Prisma.Decimal when price is included in update dto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ ...baseProduct, sku: 'LAPTOP-001' });
      mockPrisma.product.update.mockResolvedValue(baseProduct);

      await service.update('prod-1', { name: 'Updated Laptop', price: 1200, sku: 'LAPTOP-001' } as any);

      const updateCall = mockPrisma.product.update.mock.calls[0][0];
      expect(updateCall.data.price).toBeInstanceOf(MockDecimal);
    });

    it('does not wrap price when price is not in update dto', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(baseProduct);
      mockPrisma.product.update.mockResolvedValue(baseProduct);

      await service.update('prod-1', { name: 'Updated Laptop', sku: 'LAPTOP-001' } as any);

      const updateCall = mockPrisma.product.update.mock.calls[0][0];
      expect(updateCall.data.price).toBeUndefined();
    });

    it('throws NotFoundException when product to update does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' } as any)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when new SKU is already taken by another product', async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(baseProduct)                                         // existing product found
        .mockResolvedValueOnce({ ...baseProduct, id: 'prod-2', sku: 'LAPTOP-002' }); // new sku is taken

      await expect(service.update('prod-1', updateDto as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── updateStock ──────────────────────────────────────────────────────────────

  describe('updateStock', () => {
    it('increases stock and returns updated product', async () => {
      const productWithStock10 = { ...baseProduct, stock: 10 };
      const productWithStock15 = { ...baseProduct, stock: 15 };
      mockPrisma.product.findUnique.mockResolvedValue(productWithStock10);
      mockPrisma.product.update.mockResolvedValue(productWithStock15);

      const result = await service.updateStock('prod-1', 5);

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: 15 },
        include: { category: true },
      });
      expect(result.stock).toBe(15);
    });

    it('decreases stock when negative quantity is provided', async () => {
      const productWithStock10 = { ...baseProduct, stock: 10 };
      const productWithStock7 = { ...baseProduct, stock: 7 };
      mockPrisma.product.findUnique.mockResolvedValue(productWithStock10);
      mockPrisma.product.update.mockResolvedValue(productWithStock7);

      await service.updateStock('prod-1', -3);

      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 7 } }),
      );
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.updateStock('nonexistent', 5)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when resulting stock would be negative', async () => {
      const productWithStock5 = { ...baseProduct, stock: 5 };
      mockPrisma.product.findUnique.mockResolvedValue(productWithStock5);

      await expect(service.updateStock('prod-1', -10)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('allows stock to reach exactly zero', async () => {
      const productWithStock5 = { ...baseProduct, stock: 5 };
      const productWithStock0 = { ...baseProduct, stock: 0 };
      mockPrisma.product.findUnique.mockResolvedValue(productWithStock5);
      mockPrisma.product.update.mockResolvedValue(productWithStock0);

      const result = await service.updateStock('prod-1', -5);

      expect(result.stock).toBe(0);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a product with no order items and returns success message', async () => {
      const productNoOrders = { ...baseProduct, orderItems: [], cartItems: [] };
      mockPrisma.product.findUnique.mockResolvedValue(productNoOrders);
      mockPrisma.product.delete.mockResolvedValue(baseProduct);

      const result = await service.remove('prod-1');

      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
      expect(result.message).toBe('Product deleted succesfully');
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('NotFoundException message says product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow('Product not found');
    });

    it('throws BadRequestException when product has order items', async () => {
      const productWithOrders = {
        ...baseProduct,
        orderItems: [{ id: 'order-item-1' }],
        cartItems: [],
      };
      mockPrisma.product.findUnique.mockResolvedValue(productWithOrders);

      await expect(service.remove('prod-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('BadRequestException message mentions orders and inactivity suggestion', async () => {
      const productWithOrders = {
        ...baseProduct,
        orderItems: [{ id: 'order-item-1' }],
        cartItems: [],
      };
      mockPrisma.product.findUnique.mockResolvedValue(productWithOrders);

      await expect(service.remove('prod-1')).rejects.toThrow('Cannot delete product');
    });

    it('findUnique for remove includes orderItems and cartItems', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('prod-1')).rejects.toThrow(NotFoundException);

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        include: { orderItems: true, cartItems: true },
      });
    });
  });
});
