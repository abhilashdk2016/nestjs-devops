jest.mock('stripe');
import Stripe from 'stripe';

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
};
(Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
  () => mockStripeInstance as any,
);

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const mockOrder = {
  id: 'order-id',
  userId: 'user-id',
  status: 'PENDING' as OrderStatus,
  cartId: 'cart-id',
};

const mockPayment = {
  id: 'pay-id',
  userId: 'user-id',
  orderId: 'order-id',
  amount: { toString: () => '100' },
  status: 'PENDING' as PaymentStatus,
  curency: 'USD',
  paymentMethod: null,
  transactionId: 'pi_123',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// PrismaService mock
// ---------------------------------------------------------------------------
const txMock = {
  order: { update: jest.fn() },
  payment: { update: jest.fn() },
  cart: { update: jest.fn() },
};

const mockPrismaService = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  cart: {
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((cb) => cb(txMock)),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('sk_test_mock') },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    // Reset all mocks between tests
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((cb: any) => cb(txMock));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // createPaymentIntent
  // =========================================================================
  describe('createPaymentIntent', () => {
    const dto = { orderId: 'order-id', amount: 100, currency: 'usd', description: 'test' };

    it('should create a payment intent and upsert payment record', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret_abc',
      });
      mockPrismaService.payment.upsert.mockResolvedValue({ ...mockPayment, id: 'pay-id' });

      const result = await service.createPaymentIntent('user-id', dto);

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-id', userId: 'user-id' },
      });
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'usd',
        description: 'test',
        metadata: { orderId: 'order-id', userId: 'user-id' },
      });
      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-id' },
          create: expect.objectContaining({
            userId: 'user-id',
            orderId: 'order-id',
            amount: 100,
            curency: 'USD',
            status: PaymentStatus.PENDING,
            transactionId: 'pi_123',
          }),
          update: expect.objectContaining({
            transactionId: 'pi_123',
            status: PaymentStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual({
        success: true,
        data: { clientSecret: 'pi_123_secret_abc', paymentId: 'pay-id' },
        message: 'Payment intent created',
      });
    });

    it('should use default currency "usd" when not provided', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_456',
        client_secret: 'pi_456_secret',
      });
      mockPrismaService.payment.upsert.mockResolvedValue({ ...mockPayment, id: 'pay-id2' });

      const dtoWithoutCurrency = { orderId: 'order-id', amount: 50 };
      await service.createPaymentIntent('user-id', dtoWithoutCurrency as any);

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'usd' }),
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.createPaymentIntent('user-id', dto)).rejects.toThrow(
        new NotFoundException('Order not found'),
      );
      expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when order status is CANCELLED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await expect(service.createPaymentIntent('user-id', dto)).rejects.toThrow(
        new BadRequestException(`Cannot process payment for an order with status: ${OrderStatus.CANCELLED}`),
      );
      expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when order status is DELIVERED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      await expect(service.createPaymentIntent('user-id', dto)).rejects.toThrow(
        new BadRequestException(`Cannot process payment for an order with status: ${OrderStatus.DELIVERED}`),
      );
    });

    it('should throw ConflictException when existing payment is COMPLETED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      await expect(service.createPaymentIntent('user-id', dto)).rejects.toThrow(
        new ConflictException('Payment for this order has already been completed'),
      );
      expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should proceed normally when existing payment is PENDING (not COMPLETED)', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PENDING,
      });
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_789',
        client_secret: 'pi_789_secret',
      });
      mockPrismaService.payment.upsert.mockResolvedValue({ ...mockPayment, id: 'pay-id' });

      const result = await service.createPaymentIntent('user-id', dto);

      expect(result.success).toBe(true);
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalled();
    });

    it('should proceed normally when existing payment is FAILED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_retry',
        client_secret: 'pi_retry_secret',
      });
      mockPrismaService.payment.upsert.mockResolvedValue({ ...mockPayment, id: 'pay-id' });

      const result = await service.createPaymentIntent('user-id', dto);

      expect(result.success).toBe(true);
    });

    it('should round amount to smallest currency unit', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_round',
        client_secret: 'pi_round_secret',
      });
      mockPrismaService.payment.upsert.mockResolvedValue(mockPayment);

      await service.createPaymentIntent('user-id', { ...dto, amount: 19.99 });

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1999 }),
      );
    });
  });

  // =========================================================================
  // confirmPayment
  // =========================================================================
  describe('confirmPayment', () => {
    const dto = { paymentIntentId: 'pi_123', orderId: 'order-id' };

    it('should confirm payment and update order to PROCESSING on success', async () => {
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        paymentMethod: 'card',
      };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        payment_method_types: ['card'],
      });
      txMock.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.PROCESSING, cartId: 'cart-id' });
      txMock.cart.update.mockResolvedValue({});
      txMock.payment.update.mockResolvedValue(updatedPayment);

      const result = await service.confirmPayment('user-id', dto);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { transactionId: 'pi_123', orderId: 'order-id', userId: 'user-id' },
      });
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
      expect(txMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-id' },
        data: { status: OrderStatus.PROCESSING },
      });
      expect(txMock.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-id' },
        data: { checkedOut: true },
      });
      expect(txMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-id' },
        data: { status: PaymentStatus.COMPLETED, paymentMethod: 'card' },
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment confirmed successfully');
      expect(result.data.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should set payment to FAILED when stripe status is not succeeded', async () => {
      const failedPayment = { ...mockPayment, status: PaymentStatus.FAILED, paymentMethod: null };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
        status: 'requires_payment_method',
        payment_method_types: [],
      });
      txMock.payment.update.mockResolvedValue(failedPayment);

      const result = await service.confirmPayment('user-id', dto);

      expect(txMock.order.update).not.toHaveBeenCalled();
      expect(txMock.cart.update).not.toHaveBeenCalled();
      expect(txMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-id' },
        data: { status: PaymentStatus.FAILED, paymentMethod: null },
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment failed');
      expect(result.data.status).toBe(PaymentStatus.FAILED);
    });

    it('should skip cart update when order has no cartId', async () => {
      const orderWithoutCart = { ...mockOrder, cartId: null };
      const completedPayment = { ...mockPayment, status: PaymentStatus.COMPLETED, paymentMethod: 'card' };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        payment_method_types: ['card'],
      });
      txMock.order.update.mockResolvedValue(orderWithoutCart);
      txMock.payment.update.mockResolvedValue(completedPayment);

      await service.confirmPayment('user-id', dto);

      expect(txMock.order.update).toHaveBeenCalled();
      expect(txMock.cart.update).not.toHaveBeenCalled();
    });

    it('should use null for paymentMethod when payment_method_types is empty', async () => {
      const completedPayment = { ...mockPayment, status: PaymentStatus.COMPLETED, paymentMethod: null };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        payment_method_types: [],
      });
      txMock.order.update.mockResolvedValue({ ...mockOrder, cartId: null });
      txMock.payment.update.mockResolvedValue(completedPayment);

      await service.confirmPayment('user-id', dto);

      expect(txMock.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentMethod: null }),
        }),
      );
    });

    it('should throw NotFoundException when payment record does not exist', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.confirmPayment('user-id', dto)).rejects.toThrow(
        new NotFoundException('Payment record not found'),
      );
      expect(mockStripeInstance.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when payment is already COMPLETED', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      await expect(service.confirmPayment('user-id', dto)).rejects.toThrow(
        new ConflictException('Payment has already been confirmed'),
      );
      expect(mockStripeInstance.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it('should return correctly shaped PaymentApiResponseDTO', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        paymentMethod: 'card',
        transactionId: 'pi_123',
      };

      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        payment_method_types: ['card'],
      });
      txMock.order.update.mockResolvedValue({ ...mockOrder, cartId: null });
      txMock.payment.update.mockResolvedValue(completedPayment);

      const result = await service.confirmPayment('user-id', dto);

      expect(result.data).toMatchObject({
        id: 'pay-id',
        userId: 'user-id',
        orderId: 'order-id',
        currency: 'USD',
        amountPaid: 100,
        status: PaymentStatus.COMPLETED,
        paymentMethod: 'card',
        transactionId: 'pi_123',
      });
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // findById
  // =========================================================================
  describe('findById', () => {
    it('should return payment response when payment is found', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await service.findById('pay-id', 'user-id');

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'pay-id', userId: 'user-id' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'pay-id',
        userId: 'user-id',
        orderId: 'order-id',
        currency: 'USD',
        amountPaid: 100,
        status: PaymentStatus.PENDING,
        paymentMethod: null,
        transactionId: 'pi_123',
      });
    });

    it('should throw NotFoundException when payment is not found', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', 'user-id')).rejects.toThrow(
        new NotFoundException('Payment not found'),
      );
    });

    it('should not return payment belonging to a different user', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.findById('pay-id', 'other-user-id')).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'pay-id', userId: 'other-user-id' },
      });
    });
  });

  // =========================================================================
  // findByOrderId
  // =========================================================================
  describe('findByOrderId', () => {
    it('should return payment response when payment for order is found', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await service.findByOrderId('order-id', 'user-id');

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: 'order-id', userId: 'user-id' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'pay-id',
        orderId: 'order-id',
        userId: 'user-id',
        currency: 'USD',
        amountPaid: 100,
        status: PaymentStatus.PENDING,
      });
    });

    it('should throw NotFoundException when no payment exists for the given orderId', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.findByOrderId('missing-order-id', 'user-id')).rejects.toThrow(
        new NotFoundException('Payment not found for this order'),
      );
    });

    it('should scope lookup to userId so another user cannot access the payment', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      await expect(service.findByOrderId('order-id', 'other-user-id')).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: 'order-id', userId: 'other-user-id' },
      });
    });
  });

  // =========================================================================
  // findAllByUser
  // =========================================================================
  describe('findAllByUser', () => {
    it('should return all payments for the user ordered by createdAt desc', async () => {
      const secondPayment = {
        ...mockPayment,
        id: 'pay-id-2',
        orderId: 'order-id-2',
        createdAt: new Date('2024-02-01T00:00:00Z'),
        updatedAt: new Date('2024-02-01T00:00:00Z'),
      };
      mockPrismaService.payment.findMany.mockResolvedValue([secondPayment, mockPayment]);

      const result = await service.findAllByUser('user-id');

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ id: 'pay-id-2', orderId: 'order-id-2' });
      expect(result.data[1]).toMatchObject({ id: 'pay-id', orderId: 'order-id' });
    });

    it('should return empty array when user has no payments', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser('user-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should map Decimal amount to a number for each payment', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);

      const result = await service.findAllByUser('user-id');

      expect(typeof result.data[0].amountPaid).toBe('number');
      expect(result.data[0].amountPaid).toBe(100);
    });

    it('should map curency field to currency in response', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);

      const result = await service.findAllByUser('user-id');

      expect(result.data[0].currency).toBe('USD');
    });
  });
});
