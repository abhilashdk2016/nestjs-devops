import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentIntentDTO } from './dto/create-payment-intent.dto';
import { CreatePaymentIntentApiResponseDTO, PaymentApiResponseDTO } from './dto/payment-response.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { ConfirmPaymentDTO } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
    private stripe: InstanceType<typeof Stripe>;

    constructor(
        private prismaService: PrismaService,
        private configService: ConfigService
    ) {
        this.stripe = new Stripe(this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'), {
            apiVersion: '2026-05-27.dahlia'
        });
    }

    async createPaymentIntent(userId: string, createPaymentIntentDto: CreatePaymentIntentDTO): Promise<CreatePaymentIntentApiResponseDTO> {
        const { orderId, amount, currency = 'usd', description } = createPaymentIntentDto;

        const order = await this.prismaService.order.findUnique({ where: { id: orderId, userId } });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
            throw new BadRequestException(`Cannot process payment for an order with status: ${order.status}`);
        }

        const existingPayment = await this.prismaService.payment.findUnique({ where: { orderId } });

        if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
            throw new ConflictException('Payment for this order has already been completed');
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            description,
            metadata: { orderId, userId }
        });

        const payment = await this.prismaService.payment.upsert({
            where: { orderId },
            create: {
                userId,
                orderId,
                amount,
                curency: currency.toUpperCase(),
                status: PaymentStatus.PENDING,
                transactionId: paymentIntent.id
            },
            update: {
                transactionId: paymentIntent.id,
                status: PaymentStatus.PENDING
            }
        });

        return {
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret!,
                paymentId: payment.id
            },
            message: "Payment intent created"
        };
    }

    async confirmPayment(userId: string, confirmPaymentDto: ConfirmPaymentDTO): Promise<PaymentApiResponseDTO> {
        const { paymentIntentId, orderId } = confirmPaymentDto;

        const payment = await this.prismaService.payment.findFirst({
            where: { transactionId: paymentIntentId, orderId, userId }
        });

        if (!payment) {
            throw new NotFoundException('Payment record not found');
        }

        if (payment.status === PaymentStatus.COMPLETED) {
            throw new ConflictException('Payment has already been confirmed');
        }

        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        const newPaymentStatus = paymentIntent.status === 'succeeded'
            ? PaymentStatus.COMPLETED
            : PaymentStatus.FAILED;

        const updatedPayment = await this.prismaService.$transaction(async (tx) => {
            if (newPaymentStatus === PaymentStatus.COMPLETED) {
                const order = await tx.order.update({
                    where: { id: orderId },
                    data: { status: OrderStatus.PROCESSING }
                });

                if (order.cartId) {
                    await tx.cart.update({
                        where: { id: order.cartId },
                        data: { checkedOut: true }
                    });
                }
            }

            return tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: newPaymentStatus,
                    paymentMethod: paymentIntent.payment_method_types?.[0] ?? null
                }
            });
        });

        return {
            success: newPaymentStatus === PaymentStatus.COMPLETED,
            data: {
                id: updatedPayment.id,
                userId: updatedPayment.userId,
                orderId: updatedPayment.orderId,
                currency: updatedPayment.curency,
                amountPaid: Number(updatedPayment.amount),
                status: updatedPayment.status,
                paymentMethod: updatedPayment.paymentMethod,
                transactionId: updatedPayment.transactionId,
                createdAt: updatedPayment.createdAt,
                updatedAt: updatedPayment.updatedAt
            },
            message: newPaymentStatus === PaymentStatus.COMPLETED
                ? 'Payment confirmed successfully'
                : 'Payment failed'
        };
    }

    async findById(id: string, userId: string): Promise<PaymentApiResponseDTO> {
        const payment = await this.prismaService.payment.findFirst({
            where: { id, userId }
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return {
            success: true,
            data: {
                id: payment.id,
                userId: payment.userId,
                orderId: payment.orderId,
                currency: payment.curency,
                amountPaid: Number(payment.amount),
                status: payment.status,
                paymentMethod: payment.paymentMethod,
                transactionId: payment.transactionId,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            }
        };
    }

    async findByOrderId(orderId: string, userId: string): Promise<PaymentApiResponseDTO> {
        const payment = await this.prismaService.payment.findFirst({
            where: { orderId, userId }
        });

        if (!payment) {
            throw new NotFoundException('Payment not found for this order');
        }

        return {
            success: true,
            data: {
                id: payment.id,
                userId: payment.userId,
                orderId: payment.orderId,
                currency: payment.curency,
                amountPaid: Number(payment.amount),
                status: payment.status,
                paymentMethod: payment.paymentMethod,
                transactionId: payment.transactionId,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt
            }
        };
    }

    async findAllByUser(userId: string): Promise<{ success: boolean; data: PaymentApiResponseDTO['data'][] }> {
        const payments = await this.prismaService.payment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return {
            success: true,
            data: payments.map(p => ({
                id: p.id,
                userId: p.userId,
                orderId: p.orderId,
                currency: p.curency,
                amountPaid: Number(p.amount),
                status: p.status,
                paymentMethod: p.paymentMethod,
                transactionId: p.transactionId,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt
            }))
        };
    }
}
