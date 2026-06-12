import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';

const mockProductsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneBySku: jest.fn(),
  update: jest.fn(),
  updateStock: jest.fn(),
  remove: jest.fn(),
};

const allowAllGuard = { canActivate: () => true };

const productResponse = {
  id: 'prod-1',
  name: 'Laptop',
  description: 'A high end computing machine',
  price: 999.99,
  stock: 10,
  sku: 'LAPTOP-001',
  imageUrl: 'https://example.com/laptop.png',
  isActive: true,
  categoryId: 'cat-1',
  category: 'Electronics',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

const paginatedResponse = {
  data: [productResponse],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    })
      .overrideGuard(JwtAuthGaurd)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGaurd)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── POST / ───────────────────────────────────────────────────────────────────

  describe('createcategory (POST /products)', () => {
    it('delegates to ProductsService.create and returns the result', async () => {
      mockProductsService.create.mockResolvedValue(productResponse);

      const dto = {
        name: 'Laptop',
        price: 999.99,
        stock: 10,
        sku: 'LAPTOP-001',
        categoryId: 'cat-1',
      };
      const result = await controller.createcategory(dto as any);

      expect(mockProductsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(productResponse);
    });

    it('propagates ConflictException when SKU already exists', async () => {
      const { ConflictException } = await import('@nestjs/common');
      mockProductsService.create.mockRejectedValue(new ConflictException('Product already exists'));

      await expect(controller.createcategory({ sku: 'LAPTOP-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── GET / ────────────────────────────────────────────────────────────────────

  describe('findAll (GET /products)', () => {
    it('delegates to ProductsService.findAll with the query DTO', async () => {
      mockProductsService.findAll.mockResolvedValue(paginatedResponse);

      const queryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(queryDto as any);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(paginatedResponse);
    });

    it('passes all filters through to service', async () => {
      mockProductsService.findAll.mockResolvedValue(paginatedResponse);

      const queryDto = { category: 'cat-1', isActive: true, search: 'laptop', page: 1, limit: 5 };
      await controller.findAll(queryDto as any);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────────

  describe('findOne (GET /products/:id)', () => {
    it('delegates to ProductsService.findOne with the id param', async () => {
      mockProductsService.findOne.mockResolvedValue(productResponse);

      const result = await controller.findOne('prod-1');

      expect(mockProductsService.findOne).toHaveBeenCalledWith('prod-1');
      expect(result).toEqual(productResponse);
    });

    it('propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockProductsService.findOne.mockRejectedValue(new NotFoundException('Specified product not found'));

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── GET /sku/:sku ────────────────────────────────────────────────────────────

  describe('findOneBySku (GET /products/sku/:sku)', () => {
    it('delegates to ProductsService.findOneBySku with the sku param', async () => {
      mockProductsService.findOneBySku.mockResolvedValue(productResponse);

      const result = await controller.findOneBySku('LAPTOP-001');

      expect(mockProductsService.findOneBySku).toHaveBeenCalledWith('LAPTOP-001');
      expect(result).toEqual(productResponse);
    });

    it('propagates NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockProductsService.findOneBySku.mockRejectedValue(
        new NotFoundException('Specified product not found'),
      );

      await expect(controller.findOneBySku('UNKNOWN-SKU')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── PATCH /:id ───────────────────────────────────────────────────────────────

  describe('update (PATCH /products/:id)', () => {
    it('delegates to ProductsService.update with id and dto', async () => {
      const updatedProduct = { ...productResponse, name: 'Pro Laptop' };
      mockProductsService.update.mockResolvedValue(updatedProduct);

      const dto = { name: 'Pro Laptop' };
      const result = await controller.update('prod-1', dto as any);

      expect(mockProductsService.update).toHaveBeenCalledWith('prod-1', dto);
      expect(result.name).toBe('Pro Laptop');
    });

    it('propagates NotFoundException when product is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockProductsService.update.mockRejectedValue(new NotFoundException('Specified product not found'));

      await expect(controller.update('nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException when new SKU is taken', async () => {
      const { ConflictException } = await import('@nestjs/common');
      mockProductsService.update.mockRejectedValue(new ConflictException('Product with sku already exists'));

      await expect(controller.update('prod-1', { sku: 'TAKEN-SKU' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── PATCH /:id/stock ─────────────────────────────────────────────────────────

  describe('updateStock (PATCH /products/:id/stock)', () => {
    it('delegates to ProductsService.updateStock with id and quantity', async () => {
      const updatedProduct = { ...productResponse, stock: 15 };
      mockProductsService.updateStock.mockResolvedValue(updatedProduct);

      const result = await controller.updateStock('prod-1', 5);

      expect(mockProductsService.updateStock).toHaveBeenCalledWith('prod-1', 5);
      expect(result.stock).toBe(15);
    });

    it('delegates negative quantity for stock deduction', async () => {
      const updatedProduct = { ...productResponse, stock: 7 };
      mockProductsService.updateStock.mockResolvedValue(updatedProduct);

      await controller.updateStock('prod-1', -3);

      expect(mockProductsService.updateStock).toHaveBeenCalledWith('prod-1', -3);
    });

    it('propagates BadRequestException when stock would go negative', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockProductsService.updateStock.mockRejectedValue(
        new BadRequestException('Stock cannot be negative'),
      );

      await expect(controller.updateStock('prod-1', -999)).rejects.toThrow(BadRequestException);
    });

    it('propagates NotFoundException when product is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockProductsService.updateStock.mockRejectedValue(
        new NotFoundException('Specified product not found'),
      );

      await expect(controller.updateStock('nonexistent', 5)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────

  describe('deleteUserByAdmin (DELETE /products/:id)', () => {
    it('delegates to ProductsService.remove with the id param', async () => {
      mockProductsService.remove.mockResolvedValue({ message: 'Product deleted succesfully' });

      const result = await controller.deleteUserByAdmin('prod-1');

      expect(mockProductsService.remove).toHaveBeenCalledWith('prod-1');
      expect(result.message).toBe('Product deleted succesfully');
    });

    it('propagates NotFoundException when product is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockProductsService.remove.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.deleteUserByAdmin('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException when product has order items', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockProductsService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete product as it is part of existing orders'),
      );

      await expect(controller.deleteUserByAdmin('prod-1')).rejects.toThrow(BadRequestException);
    });
  });
});
