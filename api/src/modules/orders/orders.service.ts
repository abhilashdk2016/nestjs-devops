import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Order, OrderItem, OrderStatus, Prisma, Product, Role, User } from '@prisma/client';
import { CreateOrderDTO } from './dto/create-order.dto';
import { OrderData, OrderResponseDTO } from './dto/order-response.dto';
import { QueryOrderDTO } from './dto/query-order.dto';
import { UpdateOrderDTO } from './dto/update-order-status.dto';
import { UpdateUserOrderDTO } from './dto/update-user-order.dto';

@Injectable()
export class OrdersService {
    constructor(private prismaService: PrismaService) { }

    async create(userId: string, createOrderDto: CreateOrderDTO): Promise<OrderResponseDTO> {
        const { items, shippingAddress } = createOrderDto;

        const productIds = items.map(item => item.productId);
        const products = await this.prismaService.product.findMany({
            where: { id: { in: productIds }, isActive: true }
        });

        if (products.length !== productIds.length) {
            throw new NotFoundException('One or more products not found or inactive');
        }

        const productMap = new Map(products.map(p => [p.id, p]));
        let totalAmount = new Prisma.Decimal(0);

        const orderItemsData = items.map(item => {
            const product = productMap.get(item.productId)!;
            if (product.stock < item.quantity) {
                throw new BadRequestException(`Insufficient stock for product: ${product.name}`);
            }
            totalAmount = totalAmount.add(new Prisma.Decimal(product.price).mul(item.quantity));
            return {
                productId: item.productId,
                quatity: item.quantity,
                price: new Prisma.Decimal(product.price)
            };
        });

        const latestCart = await this.prismaService.cart.findFirst({
            where: {
                userId,
                checkedOut: false,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const order = await this.prismaService.$transaction(async (tx) => {
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }
            return tx.order.create({
                data: {
                    userId,
                    totalAmount,
                    shippingAddress,
                    orderItems:
                    {
                        create: orderItemsData
                    },
                    status: OrderStatus.PENDING,
                    cartId: latestCart.id
                },
                include: {
                    orderItems: {
                        include: {
                            product: true
                        }
                    },
                    user: true
                }
            });
        });

        return { success: true, data: this.toOrderData(order) };
    }

    async findAll(userId: string, role: Role, queryDto: QueryOrderDTO) {
        const { status, userId: filterUserId, search, page = 1, limit = 10 } = queryDto;
        const where: Prisma.OrderWhereInput = {};

        if (role !== Role.ADMIN) {
            where.userId = userId;
        } else if (filterUserId) {
            where.userId = filterUserId;
        }

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { id: { contains: search, mode: 'insensitive' } }
            ];
        }

        const total = await this.prismaService.order.count({ where });
        const orders = await this.prismaService.order.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { orderItems: { include: { product: true } }, user: true }
        });

        return {
            success: true,
            data: orders.map(order => this.toOrderData(order)),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    async findOne(id: string, userId: string, role: Role): Promise<OrderResponseDTO> {
        const order = await this.prismaService.order.findUnique({
            where: { id },
            include: { orderItems: { include: { product: true } }, user: true }
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (role !== Role.ADMIN && order.userId !== userId) {
            throw new ForbiddenException('You do not have access to this order');
        }

        return { success: true, data: this.toOrderData(order) };
    }

    async update(id: string, updateOrderDto: UpdateOrderDTO): Promise<OrderResponseDTO> {
        const order = await this.prismaService.order.findUnique({ where: { id } });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const updatedOrder = await this.prismaService.order.update({
            where: { id },
            data: updateOrderDto,
            include: { orderItems: { include: { product: true } }, user: true }
        });

        return { success: true, data: this.toOrderData(updatedOrder) };
    }

    async updateUserOrder(id: string, userId: string, dto: UpdateUserOrderDTO): Promise<OrderResponseDTO> {
        const order = await this.prismaService.order.findUnique({
            where: { id },
            include: { orderItems: true }
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('You do not have access to this order');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('Order can only be modified while in PENDING status');
        }

        const updatedOrder = await this.prismaService.$transaction(async (tx) => {
            if (dto.items && dto.items.length > 0) {
                const productIds = dto.items.map(i => i.productId);
                const products = await tx.product.findMany({
                    where: { id: { in: productIds }, isActive: true }
                });

                if (products.length !== productIds.length) {
                    throw new NotFoundException('One or more products not found or inactive');
                }

                const productMap = new Map(products.map(p => [p.id, p]));

                // Restore stock for existing items
                for (const item of order.orderItems) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quatity } }
                    });
                }

                // Validate stock and compute new total
                let totalAmount = new Prisma.Decimal(0);
                const newItems = dto.items.map(item => {
                    const product = productMap.get(item.productId)!;
                    if (product.stock < item.quantity) {
                        throw new BadRequestException(`Insufficient stock for product: ${product.name}`);
                    }
                    totalAmount = totalAmount.add(new Prisma.Decimal(product.price).mul(item.quantity));
                    return {
                        productId: item.productId,
                        quatity: item.quantity,
                        price: new Prisma.Decimal(product.price)
                    };
                });

                // Decrement stock for new items
                for (const item of dto.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    });
                }

                // Replace order items and update total
                await tx.orderItem.deleteMany({ where: { orderId: id } });

                return tx.order.update({
                    where: { id },
                    data: {
                        totalAmount,
                        ...(dto.shippingAddress && { shippingAddress: dto.shippingAddress }),
                        orderItems: { create: newItems }
                    },
                    include: { orderItems: { include: { product: true } }, user: true }
                });
            }

            return tx.order.update({
                where: { id },
                data: {
                    ...(dto.shippingAddress && { shippingAddress: dto.shippingAddress }),
                },
                include: { orderItems: { include: { product: true } }, user: true }
            });
        });

        return { success: true, data: this.toOrderData(updatedOrder) };
    }

    async remove(id: string, userId: string, role: Role): Promise<OrderResponseDTO> {
        const order = await this.prismaService.order.findUnique({
            where: { id },
            include: { orderItems: { include: { product: true } } }
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (role !== Role.ADMIN && order.userId !== userId) {
            throw new ForbiddenException('You do not have access to this order');
        }

        if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException(`Cannot cancel an order with status: ${order.status}`);
        }

        const cancelled = await this.prismaService.$transaction(async (tx) => {
            for (const item of order.orderItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quatity } }
                });
            }
            return tx.order.update({
                where: { id },
                data: { status: OrderStatus.CANCELLED },
                include: { orderItems: { include: { product: true } }, user: true }
            });
        });

        return { success: true, data: this.toOrderData(cancelled), message: 'Order cancelled successfully' };
    }

    private toOrderData(order: Order & { orderItems: (OrderItem & { product: Product })[]; user: User }): OrderData {
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: Number(order.totalAmount),
            userId: order.userId,
            shippingAddress: order.shippingAddress ?? '',
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            orderItems: order.orderItems.map(item => ({
                id: item.id,
                quatity: item.quatity,
                price: Number(item.price),
                subTotal: Number(item.price) * item.quatity,
                productId: item.productId,
                productName: item.product.name,
                orderId: item.orderId,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            })),
            ...(order.user && {
                userEmail: order.user.email,
                userName: `${order.user.firstName || ''}${order.user.lastName || ''}`.trim()
            })
        };
    }
}
