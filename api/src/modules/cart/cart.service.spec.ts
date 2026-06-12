import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CartService } from './cart.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AddCartItemDTO } from './dto/add-cart-item.dto';
import { UpdateCartItemDTO } from './dto/update-cart-item.dto';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-id';
const CART_ID = 'cart-id';
const ITEM_ID = 'item-id';
const PROD_ID = 'prod-id';

// Decimal-like object: CartService calls Number(item.product.price)
const makeDecimalLike = (value: string) => ({ toString: () => value, valueOf: () => +value });

const mockProduct = {
    id: PROD_ID,
    name: 'Laptop',
    price: makeDecimalLike('99.99'),
    imageUrl: null,
    stock: 10,
    isActive: true,
};

const mockCartItem = {
    id: ITEM_ID,
    productId: PROD_ID,
    cartId: CART_ID,
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: mockProduct,
};

const mockCart = {
    id: CART_ID,
    userId: USER_ID,
    checkedOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    cartItems: [mockCartItem],
};

const emptyCart = { ...mockCart, cartItems: [] };

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
    cart: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
    },
    cartItem: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
    },
    product: {
        findUnique: jest.fn(),
    },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CartService', () => {
    let service: CartService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CartService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<CartService>(CartService);
        jest.clearAllMocks();
    });

    // ─── getCart ──────────────────────────────────────────────────────────────

    describe('getCart', () => {
        it('should return the active cart for the user', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);

            const result = await service.getCart(USER_ID);

            expect(result.success).toBe(true);
            expect(result.data.id).toBe(CART_ID);
            expect(result.data.userId).toBe(USER_ID);
            expect(result.data.items).toHaveLength(1);
            expect(result.data.items[0].productId).toBe(PROD_ID);
            expect(result.data.items[0].quantity).toBe(2);
            expect(result.data.items[0].price).toBe(99.99);
            expect(result.data.items[0].subTotal).toBe(99.99 * 2);
        });

        it('should create a new cart when no active cart exists', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(null);
            mockPrisma.cart.create.mockResolvedValue(emptyCart);

            const result = await service.getCart(USER_ID);

            expect(mockPrisma.cart.create).toHaveBeenCalledWith({
                data: { userId: USER_ID },
                include: { cartItems: { include: { product: true } } },
            });
            expect(result.success).toBe(true);
            expect(result.data.items).toHaveLength(0);
        });

        it('should compute total as sum of all item subtotals', async () => {
            const multiItemCart = {
                ...mockCart,
                cartItems: [
                    { ...mockCartItem, quantity: 2 },
                    {
                        id: 'item-id-2',
                        productId: 'prod-id-2',
                        cartId: CART_ID,
                        quantity: 3,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        product: { ...mockProduct, id: 'prod-id-2', price: makeDecimalLike('10.00') },
                    },
                ],
            };
            mockPrisma.cart.findFirst.mockResolvedValue(multiItemCart);

            const result = await service.getCart(USER_ID);

            // 99.99 * 2 + 10.00 * 3 = 229.98
            expect(result.data.total).toBeCloseTo(229.98, 2);
        });
    });

    // ─── addItem ─────────────────────────────────────────────────────────────

    describe('addItem', () => {
        const dto: AddCartItemDTO = { productId: PROD_ID, quantity: 1 };

        it('should add a new item when it does not yet exist in the cart', async () => {
            mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
            mockPrisma.cart.findFirst.mockResolvedValue(emptyCart);
            mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
            mockPrisma.cart.findUnique.mockResolvedValue(mockCart);

            const result = await service.addItem(USER_ID, dto);

            expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
                data: { cartId: CART_ID, productId: PROD_ID, quantity: 1 },
            });
            expect(result.success).toBe(true);
        });

        it('should merge quantity when item already exists in the cart', async () => {
            // existingItem has quantity 2, adding 1 more → newQuantity = 3 (stock = 10, ok)
            mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart); // has item with qty 2
            mockPrisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 3 });
            mockPrisma.cart.findUnique.mockResolvedValue({
                ...mockCart,
                cartItems: [{ ...mockCartItem, quantity: 3 }],
            });

            const result = await service.addItem(USER_ID, dto);

            expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
                where: { id: ITEM_ID },
                data: { quantity: 3 },
            });
            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException when product is not found or inactive', async () => {
            mockPrisma.product.findUnique.mockResolvedValue(null);

            await expect(service.addItem(USER_ID, dto)).rejects.toThrow(NotFoundException);
            await expect(service.addItem(USER_ID, dto)).rejects.toThrow(
                'Product not found or inactive',
            );
            expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when initial quantity exceeds stock', async () => {
            const dto2: AddCartItemDTO = { productId: PROD_ID, quantity: 20 };
            mockPrisma.product.findUnique.mockResolvedValue(mockProduct); // stock = 10

            await expect(service.addItem(USER_ID, dto2)).rejects.toThrow(BadRequestException);
            await expect(service.addItem(USER_ID, dto2)).rejects.toThrow(
                `Insufficient stock for product: ${mockProduct.name}`,
            );
        });

        it('should throw BadRequestException when merged quantity exceeds stock', async () => {
            // existingItem.quantity = 2, adding 9 more → newQuantity = 11 > stock (10)
            const dtoNearMax: AddCartItemDTO = { productId: PROD_ID, quantity: 9 };
            mockPrisma.product.findUnique.mockResolvedValue(mockProduct); // stock = 10
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart); // item qty = 2

            await expect(service.addItem(USER_ID, dtoNearMax)).rejects.toThrow(BadRequestException);
            await expect(service.addItem(USER_ID, dtoNearMax)).rejects.toThrow(
                `Insufficient stock. Available: ${mockProduct.stock}`,
            );
        });
    });

    // ─── updateItem ───────────────────────────────────────────────────────────

    describe('updateItem', () => {
        const dto: UpdateCartItemDTO = { quantity: 5 };

        it('should update item quantity and return updated cart', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 5 });
            mockPrisma.cart.findUnique.mockResolvedValue({
                ...mockCart,
                cartItems: [{ ...mockCartItem, quantity: 5 }],
            });

            const result = await service.updateItem(USER_ID, ITEM_ID, dto);

            expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
                where: { id: ITEM_ID },
                data: { quantity: 5 },
            });
            expect(result.success).toBe(true);
            expect(result.data.items[0].quantity).toBe(5);
        });

        it('should throw NotFoundException when the cart item does not belong to the cart', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(emptyCart); // no items

            await expect(service.updateItem(USER_ID, 'wrong-item-id', dto)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.updateItem(USER_ID, 'wrong-item-id', dto)).rejects.toThrow(
                'Cart item not found',
            );
            expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when new quantity exceeds product stock', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart); // item.product.stock = 10

            const bigDto: UpdateCartItemDTO = { quantity: 99 };

            await expect(service.updateItem(USER_ID, ITEM_ID, bigDto)).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.updateItem(USER_ID, ITEM_ID, bigDto)).rejects.toThrow(
                `Insufficient stock. Available: ${mockProduct.stock}`,
            );
        });
    });

    // ─── removeItem ───────────────────────────────────────────────────────────

    describe('removeItem', () => {
        it('should delete the item and return the updated cart with message', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.cartItem.delete.mockResolvedValue(mockCartItem);
            mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);

            const result = await service.removeItem(USER_ID, ITEM_ID);

            expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Item removed from cart');
        });

        it('should throw NotFoundException when item is not in the cart', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(emptyCart);

            await expect(service.removeItem(USER_ID, 'wrong-item-id')).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.removeItem(USER_ID, 'wrong-item-id')).rejects.toThrow(
                'Cart item not found',
            );
            expect(mockPrisma.cartItem.delete).not.toHaveBeenCalled();
        });
    });

    // ─── clearCart ────────────────────────────────────────────────────────────

    describe('clearCart', () => {
        it('should delete all cart items and return success message', async () => {
            // clearCart uses cart.findFirst (not findOrCreateCart)
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

            const result = await service.clearCart(USER_ID);

            expect(mockPrisma.cart.findFirst).toHaveBeenCalledWith({
                where: { userId: USER_ID, checkedOut: false },
            });
            expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
                where: { cartId: CART_ID },
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Cart cleared successfully');
        });

        it('should throw NotFoundException when no active cart exists', async () => {
            mockPrisma.cart.findFirst.mockResolvedValue(null);

            await expect(service.clearCart(USER_ID)).rejects.toThrow(NotFoundException);
            await expect(service.clearCart(USER_ID)).rejects.toThrow('No active cart found');
            expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
        });
    });
});
