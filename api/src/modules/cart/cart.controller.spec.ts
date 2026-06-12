import { Test, TestingModule } from '@nestjs/testing';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { AddCartItemDTO } from './dto/add-cart-item.dto';
import { UpdateCartItemDTO } from './dto/update-cart-item.dto';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-id';
const CART_ID = 'cart-id';
const ITEM_ID = 'item-id';

const mockCartData = {
    id: CART_ID,
    userId: USER_ID,
    checkedOut: false,
    items: [
        {
            id: ITEM_ID,
            productId: 'prod-id',
            productName: 'Laptop',
            productImageUrl: null,
            price: 99.99,
            quantity: 2,
            subTotal: 199.98,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ],
    total: 199.98,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockCartResponse = { success: true, data: mockCartData };

// ─── Service mock ─────────────────────────────────────────────────────────────

const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
};

// Guard that always allows
const allowAllGuard = { canActivate: () => true };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CartController', () => {
    let controller: CartController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CartController],
            providers: [
                { provide: CartService, useValue: mockCartService },
            ],
        })
            .overrideGuard(JwtAuthGaurd)
            .useValue(allowAllGuard)
            .compile();

        controller = module.get<CartController>(CartController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ─── GET /cart ────────────────────────────────────────────────────────────

    describe('getCart', () => {
        it('should call cartService.getCart with userId and return the result', async () => {
            mockCartService.getCart.mockResolvedValue(mockCartResponse);

            const result = await controller.getCart(USER_ID);

            expect(mockCartService.getCart).toHaveBeenCalledWith(USER_ID);
            expect(result).toEqual(mockCartResponse);
        });
    });

    // ─── POST /cart/items ─────────────────────────────────────────────────────

    describe('addItem', () => {
        it('should call cartService.addItem with userId and dto and return the result', async () => {
            const dto: AddCartItemDTO = { productId: 'prod-id', quantity: 1 };
            mockCartService.addItem.mockResolvedValue(mockCartResponse);

            const result = await controller.addItem(USER_ID, dto);

            expect(mockCartService.addItem).toHaveBeenCalledWith(USER_ID, dto);
            expect(result).toEqual(mockCartResponse);
        });

        it('should propagate service errors to the caller', async () => {
            const dto: AddCartItemDTO = { productId: 'bad-prod', quantity: 1 };
            mockCartService.addItem.mockRejectedValue(new Error('Product not found or inactive'));

            await expect(controller.addItem(USER_ID, dto)).rejects.toThrow(
                'Product not found or inactive',
            );
        });
    });

    // ─── PATCH /cart/items/:itemId ────────────────────────────────────────────

    describe('updateItem', () => {
        it('should call cartService.updateItem with userId, itemId, and dto', async () => {
            const dto: UpdateCartItemDTO = { quantity: 5 };
            const updatedResponse = {
                success: true,
                data: {
                    ...mockCartData,
                    items: [{ ...mockCartData.items[0], quantity: 5, subTotal: 499.95 }],
                    total: 499.95,
                },
            };
            mockCartService.updateItem.mockResolvedValue(updatedResponse);

            const result = await controller.updateItem(USER_ID, ITEM_ID, dto);

            expect(mockCartService.updateItem).toHaveBeenCalledWith(USER_ID, ITEM_ID, dto);
            expect(result).toEqual(updatedResponse);
        });

        it('should propagate NotFound when item does not exist', async () => {
            const dto: UpdateCartItemDTO = { quantity: 3 };
            mockCartService.updateItem.mockRejectedValue(new Error('Cart item not found'));

            await expect(controller.updateItem(USER_ID, 'bad-item', dto)).rejects.toThrow(
                'Cart item not found',
            );
        });
    });

    // ─── DELETE /cart/items/:itemId ───────────────────────────────────────────

    describe('removeItem', () => {
        it('should call cartService.removeItem with userId and itemId', async () => {
            const removedResponse = {
                success: true,
                data: { ...mockCartData, items: [], total: 0 },
                message: 'Item removed from cart',
            };
            mockCartService.removeItem.mockResolvedValue(removedResponse);

            const result = await controller.removeItem(USER_ID, ITEM_ID);

            expect(mockCartService.removeItem).toHaveBeenCalledWith(USER_ID, ITEM_ID);
            expect(result).toEqual(removedResponse);
        });

        it('should propagate errors for missing items', async () => {
            mockCartService.removeItem.mockRejectedValue(new Error('Cart item not found'));

            await expect(controller.removeItem(USER_ID, 'bad-item')).rejects.toThrow(
                'Cart item not found',
            );
        });
    });

    // ─── DELETE /cart ─────────────────────────────────────────────────────────

    describe('clearCart', () => {
        it('should call cartService.clearCart with userId and return success message', async () => {
            const clearResponse = { success: true, message: 'Cart cleared successfully' };
            mockCartService.clearCart.mockResolvedValue(clearResponse);

            const result = await controller.clearCart(USER_ID);

            expect(mockCartService.clearCart).toHaveBeenCalledWith(USER_ID);
            expect(result).toEqual(clearResponse);
        });

        it('should propagate NotFoundException when no active cart exists', async () => {
            mockCartService.clearCart.mockRejectedValue(new Error('No active cart found'));

            await expect(controller.clearCart(USER_ID)).rejects.toThrow('No active cart found');
        });
    });
});
