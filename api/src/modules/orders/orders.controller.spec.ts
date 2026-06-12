import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Role } from '@prisma/client';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { CreateOrderDTO } from './dto/create-order.dto';
import { UpdateOrderDTO } from './dto/update-order-status.dto';
import { UpdateUserOrderDTO } from './dto/update-user-order.dto';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-id-1';
const ORDER_ID = 'order-id-1';

const mockOrderData = {
    id: ORDER_ID,
    orderNumber: 'ORD-001',
    status: OrderStatus.PENDING,
    totalAmount: 1999.98,
    userId: USER_ID,
    shippingAddress: '123 Main St',
    orderItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockOrderResponse = { success: true, data: mockOrderData };

// ─── Service mock ─────────────────────────────────────────────────────────────

const mockOrdersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateUserOrder: jest.fn(),
    remove: jest.fn(),
};

// Guard that always allows — overrides JwtAuthGaurd and RolesGaurd
const allowAllGuard = { canActivate: () => true };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OrdersController', () => {
    let controller: OrdersController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdersController],
            providers: [
                { provide: OrdersService, useValue: mockOrdersService },
            ],
        })
            .overrideGuard(JwtAuthGaurd)
            .useValue(allowAllGuard)
            .overrideGuard(RolesGaurd)
            .useValue(allowAllGuard)
            .compile();

        controller = module.get<OrdersController>(OrdersController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ─── POST / ───────────────────────────────────────────────────────────────

    describe('create', () => {
        it('should call ordersService.create with userId and dto and return the result', async () => {
            const dto: CreateOrderDTO = {
                items: [{ productId: 'prod-id-1', quantity: 2, price: 999.99 }],
                shippingAddress: '123 Main St',
            };
            mockOrdersService.create.mockResolvedValue(mockOrderResponse);

            const result = await controller.create(USER_ID, dto);

            expect(mockOrdersService.create).toHaveBeenCalledWith(USER_ID, dto);
            expect(result).toEqual(mockOrderResponse);
        });
    });

    // ─── GET / ────────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('should call ordersService.findAll with userId, role, and queryDto', async () => {
            const paginated = {
                success: true,
                data: [mockOrderData],
                meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            };
            mockOrdersService.findAll.mockResolvedValue(paginated);

            const queryDto = { page: 1, limit: 10 };
            const result = await controller.findAll(USER_ID, Role.USER, queryDto);

            expect(mockOrdersService.findAll).toHaveBeenCalledWith(USER_ID, Role.USER, queryDto);
            expect(result).toEqual(paginated);
        });

        it('should forward ADMIN role to the service', async () => {
            mockOrdersService.findAll.mockResolvedValue({ success: true, data: [], meta: {} });

            await controller.findAll(USER_ID, Role.ADMIN, { page: 1, limit: 10 });

            expect(mockOrdersService.findAll).toHaveBeenCalledWith(
                USER_ID,
                Role.ADMIN,
                expect.any(Object),
            );
        });
    });

    // ─── GET /:id ─────────────────────────────────────────────────────────────

    describe('findOne', () => {
        it('should call ordersService.findOne with id, userId, and role', async () => {
            mockOrdersService.findOne.mockResolvedValue(mockOrderResponse);

            const result = await controller.findOne(ORDER_ID, USER_ID, Role.USER);

            expect(mockOrdersService.findOne).toHaveBeenCalledWith(ORDER_ID, USER_ID, Role.USER);
            expect(result).toEqual(mockOrderResponse);
        });
    });

    // ─── PATCH /:id ───────────────────────────────────────────────────────────

    describe('updateUserOrder', () => {
        it('should call ordersService.updateUserOrder with id, userId, and dto', async () => {
            const dto: UpdateUserOrderDTO = { shippingAddress: '456 New St' };
            mockOrdersService.updateUserOrder.mockResolvedValue(mockOrderResponse);

            const result = await controller.updateUserOrder(ORDER_ID, USER_ID, dto);

            expect(mockOrdersService.updateUserOrder).toHaveBeenCalledWith(ORDER_ID, USER_ID, dto);
            expect(result).toEqual(mockOrderResponse);
        });
    });

    // ─── PATCH /:id/status ────────────────────────────────────────────────────

    describe('update', () => {
        it('should call ordersService.update with id and dto', async () => {
            const dto: UpdateOrderDTO = { status: OrderStatus.SHIPPED };
            const updatedResponse = {
                success: true,
                data: { ...mockOrderData, status: OrderStatus.SHIPPED },
            };
            mockOrdersService.update.mockResolvedValue(updatedResponse);

            const result = await controller.update(ORDER_ID, dto);

            expect(mockOrdersService.update).toHaveBeenCalledWith(ORDER_ID, dto);
            expect(result).toEqual(updatedResponse);
        });
    });

    // ─── DELETE /:id ──────────────────────────────────────────────────────────

    describe('remove', () => {
        it('should call ordersService.remove with id, userId, and role', async () => {
            const cancelledResponse = {
                success: true,
                data: { ...mockOrderData, status: OrderStatus.CANCELLED },
                message: 'Order cancelled successfully',
            };
            mockOrdersService.remove.mockResolvedValue(cancelledResponse);

            const result = await controller.remove(ORDER_ID, USER_ID, Role.USER);

            expect(mockOrdersService.remove).toHaveBeenCalledWith(ORDER_ID, USER_ID, Role.USER);
            expect(result).toEqual(cancelledResponse);
        });

        it('should forward ADMIN role to remove', async () => {
            mockOrdersService.remove.mockResolvedValue(mockOrderResponse);

            await controller.remove(ORDER_ID, USER_ID, Role.ADMIN);

            expect(mockOrdersService.remove).toHaveBeenCalledWith(ORDER_ID, USER_ID, Role.ADMIN);
        });
    });
});
