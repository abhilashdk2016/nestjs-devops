import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';

import { OrdersService } from './orders.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateOrderDTO } from './dto/create-order.dto';
import { UpdateOrderDTO } from './dto/update-order-status.dto';
import { UpdateUserOrderDTO } from './dto/update-user-order.dto';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user-id-1';
const ORDER_ID = 'order-id-1';
const CART_ID = 'cart-id-1';
const PROD_ID_1 = 'prod-id-1';
const PROD_ID_2 = 'prod-id-2';

const mockProduct1 = {
    id: PROD_ID_1,
    name: 'Laptop',
    price: new Prisma.Decimal('999.99'),
    stock: 10,
    isActive: true,
};

const mockProduct2 = {
    id: PROD_ID_2,
    name: 'Mouse',
    price: new Prisma.Decimal('29.99'),
    stock: 5,
    isActive: true,
};

const mockUser = {
    id: USER_ID,
    email: 'user@test.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: Role.USER,
};

const makeOrderItem = (overrides: Partial<any> = {}) => ({
    id: 'item-id-1',
    orderId: ORDER_ID,
    productId: PROD_ID_1,
    quatity: 2,
    price: new Prisma.Decimal('999.99'),
    createdAt: new Date(),
    updatedAt: new Date(),
    product: mockProduct1,
    ...overrides,
});

const makeOrder = (overrides: Partial<any> = {}) => ({
    id: ORDER_ID,
    orderNumber: 'ORD-001',
    userId: USER_ID,
    status: OrderStatus.PENDING,
    totalAmount: new Prisma.Decimal('1999.98'),
    shippingAddress: '123 Main St',
    cartId: CART_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    orderItems: [makeOrderItem()],
    user: mockUser,
    ...overrides,
});

const mockCart = {
    id: CART_ID,
    userId: USER_ID,
    checkedOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
    order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    product: {
        findMany: jest.fn(),
        update: jest.fn(),
    },
    orderItem: {
        deleteMany: jest.fn(),
    },
    cart: {
        findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
    let service: OrdersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<OrdersService>(OrdersService);
        jest.clearAllMocks();

        // Default $transaction: execute callback with the same mock
        mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
    });

    // ─── create ───────────────────────────────────────────────────────────────

    describe('create', () => {
        const dto: CreateOrderDTO = {
            items: [{ productId: PROD_ID_1, quantity: 2, price: 999.99 }],
            shippingAddress: '123 Main St',
        };

        it('should create an order and return the response DTO', async () => {
            mockPrisma.product.findMany.mockResolvedValue([mockProduct1]);
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.product.update.mockResolvedValue(mockProduct1);
            mockPrisma.order.create.mockResolvedValue(makeOrder());

            const result = await service.create(USER_ID, dto);

            expect(result.success).toBe(true);
            expect(result.data.id).toBe(ORDER_ID);
            expect(result.data.status).toBe(OrderStatus.PENDING);
            expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { in: [PROD_ID_1] }, isActive: true },
                }),
            );
            expect(mockPrisma.$transaction).toHaveBeenCalled();
            expect(mockPrisma.product.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: PROD_ID_1 } }),
            );
            expect(mockPrisma.order.create).toHaveBeenCalled();
        });

        it('should throw NotFoundException when a product is missing or inactive', async () => {
            // findMany returns fewer products than requested
            mockPrisma.product.findMany.mockResolvedValue([]);

            await expect(service.create(USER_ID, dto)).rejects.toThrow(NotFoundException);
            await expect(service.create(USER_ID, dto)).rejects.toThrow(
                'One or more products not found or inactive',
            );
        });

        it('should throw BadRequestException when stock is insufficient', async () => {
            const lowStockProduct = { ...mockProduct1, stock: 1 };
            mockPrisma.product.findMany.mockResolvedValue([lowStockProduct]);

            const dtoHighQty: CreateOrderDTO = {
                items: [{ productId: PROD_ID_1, quantity: 5, price: 999.99 }],
            };

            await expect(service.create(USER_ID, dtoHighQty)).rejects.toThrow(BadRequestException);
            await expect(service.create(USER_ID, dtoHighQty)).rejects.toThrow(
                `Insufficient stock for product: ${lowStockProduct.name}`,
            );
        });

        it('should decrement stock for each ordered item inside $transaction', async () => {
            mockPrisma.product.findMany.mockResolvedValue([mockProduct1]);
            mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
            mockPrisma.product.update.mockResolvedValue(mockProduct1);
            mockPrisma.order.create.mockResolvedValue(makeOrder());

            await service.create(USER_ID, dto);

            expect(mockPrisma.product.update).toHaveBeenCalledWith({
                where: { id: PROD_ID_1 },
                data: { stock: { decrement: 2 } },
            });
        });
    });

    // ─── findAll ─────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('should return all orders for ADMIN role without userId filter', async () => {
            const orders = [makeOrder()];
            mockPrisma.order.count.mockResolvedValue(1);
            mockPrisma.order.findMany.mockResolvedValue(orders);

            const result = await service.findAll(USER_ID, Role.ADMIN, { page: 1, limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
            // ADMIN: no userId filter applied
            expect(mockPrisma.order.count).toHaveBeenCalledWith({ where: {} });
        });

        it('should restrict results to the calling user for USER role', async () => {
            mockPrisma.order.count.mockResolvedValue(1);
            mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

            await service.findAll(USER_ID, Role.USER, { page: 1, limit: 10 });

            expect(mockPrisma.order.count).toHaveBeenCalledWith({
                where: { userId: USER_ID },
            });
        });

        it('should apply status filter when provided', async () => {
            mockPrisma.order.count.mockResolvedValue(0);
            mockPrisma.order.findMany.mockResolvedValue([]);

            await service.findAll(USER_ID, Role.USER, {
                page: 1,
                limit: 10,
                status: OrderStatus.DELIVERED,
            });

            expect(mockPrisma.order.count).toHaveBeenCalledWith({
                where: { userId: USER_ID, status: OrderStatus.DELIVERED },
            });
        });

        it('should apply search filter as OR condition', async () => {
            mockPrisma.order.count.mockResolvedValue(0);
            mockPrisma.order.findMany.mockResolvedValue([]);

            await service.findAll(USER_ID, Role.USER, {
                page: 1,
                limit: 10,
                search: 'ORD-001',
            });

            const call = mockPrisma.order.count.mock.calls[0][0];
            expect(call.where.OR).toBeDefined();
        });

        it('should calculate correct pagination meta', async () => {
            mockPrisma.order.count.mockResolvedValue(25);
            mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

            const result = await service.findAll(USER_ID, Role.ADMIN, { page: 2, limit: 10 });

            expect(result.meta.totalPages).toBe(3);
            expect(result.meta.page).toBe(2);
        });

        it('should filter by userId when ADMIN provides userId in query', async () => {
            mockPrisma.order.count.mockResolvedValue(1);
            mockPrisma.order.findMany.mockResolvedValue([makeOrder()]);

            await service.findAll(USER_ID, Role.ADMIN, {
                page: 1,
                limit: 10,
                userId: 'another-user-id',
            });

            expect(mockPrisma.order.count).toHaveBeenCalledWith({
                where: { userId: 'another-user-id' },
            });
        });
    });

    // ─── findOne ─────────────────────────────────────────────────────────────

    describe('findOne', () => {
        it('should return the order when the owner requests it', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder());

            const result = await service.findOne(ORDER_ID, USER_ID, Role.USER);

            expect(result.success).toBe(true);
            expect(result.data.id).toBe(ORDER_ID);
        });

        it('should return the order for ADMIN regardless of ownership', async () => {
            const order = makeOrder({ userId: 'other-user-id' });
            mockPrisma.order.findUnique.mockResolvedValue(order);

            const result = await service.findOne(ORDER_ID, USER_ID, Role.ADMIN);

            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException when order does not exist', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);

            await expect(service.findOne('bad-id', USER_ID, Role.USER)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findOne('bad-id', USER_ID, Role.USER)).rejects.toThrow(
                'Order not found',
            );
        });

        it('should throw ForbiddenException when USER requests another user\'s order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ userId: 'other-user-id' }));

            await expect(service.findOne(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                ForbiddenException,
            );
            await expect(service.findOne(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                'You do not have access to this order',
            );
        });
    });

    // ─── update (admin) ───────────────────────────────────────────────────────

    describe('update', () => {
        const dto: UpdateOrderDTO = { status: OrderStatus.PROCESSING };

        it('should update and return the order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
            mockPrisma.order.update.mockResolvedValue(makeOrder({ status: OrderStatus.PROCESSING }));

            const result = await service.update(ORDER_ID, dto);

            expect(result.success).toBe(true);
            expect(result.data.status).toBe(OrderStatus.PROCESSING);
            expect(mockPrisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: ORDER_ID }, data: dto }),
            );
        });

        it('should throw NotFoundException when order does not exist', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);

            await expect(service.update('bad-id', dto)).rejects.toThrow(NotFoundException);
            await expect(service.update('bad-id', dto)).rejects.toThrow('Order not found');
        });

        it('should update trackingNumber and notes', async () => {
            const fullDto: UpdateOrderDTO = {
                status: OrderStatus.SHIPPED,
                trackingNumber: 'TRACK-123',
                notes: 'Left at door',
            };
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
            mockPrisma.order.update.mockResolvedValue(makeOrder({ ...fullDto }));

            const result = await service.update(ORDER_ID, fullDto);

            expect(mockPrisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: fullDto }),
            );
            expect(result.success).toBe(true);
        });
    });

    // ─── updateUserOrder ──────────────────────────────────────────────────────

    describe('updateUserOrder', () => {
        it('should update shipping address when no items are provided', async () => {
            const dto: UpdateUserOrderDTO = { shippingAddress: '456 New St' };
            mockPrisma.order.findUnique.mockResolvedValue(
                makeOrder({ orderItems: [makeOrderItem()] }),
            );
            mockPrisma.order.update.mockResolvedValue(
                makeOrder({ shippingAddress: '456 New St' }),
            );

            const result = await service.updateUserOrder(ORDER_ID, USER_ID, dto);

            expect(result.success).toBe(true);
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });

        it('should throw NotFoundException when order does not exist', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);

            await expect(
                service.updateUserOrder('bad-id', USER_ID, {}),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when USER does not own the order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ userId: 'other-user' }));

            await expect(
                service.updateUserOrder(ORDER_ID, USER_ID, {}),
            ).rejects.toThrow(ForbiddenException);
            await expect(
                service.updateUserOrder(ORDER_ID, USER_ID, {}),
            ).rejects.toThrow('You do not have access to this order');
        });

        it('should throw BadRequestException when order is not PENDING', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(
                makeOrder({ status: OrderStatus.SHIPPED }),
            );

            await expect(
                service.updateUserOrder(ORDER_ID, USER_ID, {}),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.updateUserOrder(ORDER_ID, USER_ID, {}),
            ).rejects.toThrow('Order can only be modified while in PENDING status');
        });

        it('should replace items and restore + decrement stock inside $transaction', async () => {
            const existingOrder = makeOrder({
                orderItems: [makeOrderItem({ quatity: 2, productId: PROD_ID_1 })],
            });
            mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

            const txMock = {
                product: { findMany: jest.fn(), update: jest.fn() },
                orderItem: { deleteMany: jest.fn() },
                order: { update: jest.fn() },
            };
            mockPrisma.$transaction.mockImplementation((fn) => fn(txMock));

            txMock.product.findMany.mockResolvedValue([mockProduct2]);
            txMock.product.update.mockResolvedValue({});
            txMock.orderItem.deleteMany.mockResolvedValue({});
            txMock.order.update.mockResolvedValue(
                makeOrder({ orderItems: [makeOrderItem({ productId: PROD_ID_2 })] }),
            );

            const dto: UpdateUserOrderDTO = {
                items: [{ productId: PROD_ID_2, quantity: 1 }],
            };

            const result = await service.updateUserOrder(ORDER_ID, USER_ID, dto);

            expect(result.success).toBe(true);
            // stock restore for old item
            expect(txMock.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: PROD_ID_1 },
                    data: { stock: { increment: 2 } },
                }),
            );
            // stock decrement for new item
            expect(txMock.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: PROD_ID_2 },
                    data: { stock: { decrement: 1 } },
                }),
            );
            expect(txMock.orderItem.deleteMany).toHaveBeenCalledWith({
                where: { orderId: ORDER_ID },
            });
        });

        it('should throw NotFoundException when replacement products are missing', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder());

            const txMock = {
                product: { findMany: jest.fn(), update: jest.fn() },
                orderItem: { deleteMany: jest.fn() },
                order: { update: jest.fn() },
            };
            mockPrisma.$transaction.mockImplementation((fn) => fn(txMock));
            txMock.product.findMany.mockResolvedValue([]); // missing products
            txMock.product.update.mockResolvedValue({});

            const dto: UpdateUserOrderDTO = {
                items: [{ productId: 'nonexistent-prod', quantity: 1 }],
            };

            await expect(service.updateUserOrder(ORDER_ID, USER_ID, dto)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ─── remove ───────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('should cancel a PENDING order, restore stock, and return success', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
            mockPrisma.product.update.mockResolvedValue({});
            mockPrisma.order.update.mockResolvedValue(
                makeOrder({ status: OrderStatus.CANCELLED }),
            );

            const result = await service.remove(ORDER_ID, USER_ID, Role.USER);

            expect(result.success).toBe(true);
            expect(result.data.status).toBe(OrderStatus.CANCELLED);
            expect(result.message).toBe('Order cancelled successfully');
            expect(mockPrisma.product.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { stock: { increment: 2 } } }),
            );
        });

        it('should allow ADMIN to cancel any order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ userId: 'other-user' }));
            mockPrisma.product.update.mockResolvedValue({});
            mockPrisma.order.update.mockResolvedValue(
                makeOrder({ status: OrderStatus.CANCELLED }),
            );

            const result = await service.remove(ORDER_ID, USER_ID, Role.ADMIN);

            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException when order does not exist', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);

            await expect(service.remove('bad-id', USER_ID, Role.USER)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException when USER tries to cancel another user\'s order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ userId: 'other-user' }));

            await expect(service.remove(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw BadRequestException when order is DELIVERED', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(
                makeOrder({ status: OrderStatus.DELIVERED }),
            );

            await expect(service.remove(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.remove(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                `Cannot cancel an order with status: ${OrderStatus.DELIVERED}`,
            );
        });

        it('should throw BadRequestException when order is already CANCELLED', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(
                makeOrder({ status: OrderStatus.CANCELLED }),
            );

            await expect(service.remove(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.remove(ORDER_ID, USER_ID, Role.USER)).rejects.toThrow(
                `Cannot cancel an order with status: ${OrderStatus.CANCELLED}`,
            );
        });
    });
});
