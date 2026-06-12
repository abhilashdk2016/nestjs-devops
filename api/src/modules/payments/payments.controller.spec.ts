import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { PaymentStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'user-id';

const mockPaymentResponse = {
  success: true,
  data: {
    id: 'pay-id',
    userId: USER_ID,
    orderId: 'order-id',
    currency: 'USD',
    amountPaid: 100,
    status: 'PENDING' as PaymentStatus,
    paymentMethod: null,
    transactionId: 'pi_123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
};

const mockIntentResponse = {
  success: true,
  data: { clientSecret: 'pi_123_secret_abc', paymentId: 'pay-id' },
  message: 'Payment intent created',
};

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------
const mockPaymentsService = {
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
  findAllByUser: jest.fn(),
  findById: jest.fn(),
  findByOrderId: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    })
      // Bypass the JWT guard so unit tests don't need a real token
      .overrideGuard(JwtAuthGaurd)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // =========================================================================
  // POST /payments/create-intent
  // =========================================================================
  describe('createPaymentIntent', () => {
    const createDto = { orderId: 'order-id', amount: 100, currency: 'usd', description: 'test order' };

    it('should return the payment intent response on success', async () => {
      mockPaymentsService.createPaymentIntent.mockResolvedValue(mockIntentResponse);

      const result = await controller.createPaymentIntent(createDto, USER_ID);

      expect(mockPaymentsService.createPaymentIntent).toHaveBeenCalledWith(USER_ID, createDto);
      expect(result).toEqual(mockIntentResponse);
      expect(result.success).toBe(true);
      expect(result.data.clientSecret).toBe('pi_123_secret_abc');
      expect(result.data.paymentId).toBe('pay-id');
    });

    it('should propagate NotFoundException when order is not found', async () => {
      mockPaymentsService.createPaymentIntent.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await expect(controller.createPaymentIntent(createDto, USER_ID)).rejects.toThrow(
        new NotFoundException('Order not found'),
      );
    });

    it('should propagate BadRequestException for CANCELLED order', async () => {
      mockPaymentsService.createPaymentIntent.mockRejectedValue(
        new BadRequestException('Cannot process payment for an order with status: CANCELLED'),
      );

      await expect(controller.createPaymentIntent(createDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate BadRequestException for DELIVERED order', async () => {
      mockPaymentsService.createPaymentIntent.mockRejectedValue(
        new BadRequestException('Cannot process payment for an order with status: DELIVERED'),
      );

      await expect(controller.createPaymentIntent(createDto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate ConflictException when payment is already completed', async () => {
      mockPaymentsService.createPaymentIntent.mockRejectedValue(
        new ConflictException('Payment for this order has already been completed'),
      );

      await expect(controller.createPaymentIntent(createDto, USER_ID)).rejects.toThrow(
        new ConflictException('Payment for this order has already been completed'),
      );
    });

    it('should pass userId from @GetUser decorator to the service', async () => {
      mockPaymentsService.createPaymentIntent.mockResolvedValue(mockIntentResponse);

      await controller.createPaymentIntent(createDto, 'specific-user-id');

      expect(mockPaymentsService.createPaymentIntent).toHaveBeenCalledWith(
        'specific-user-id',
        createDto,
      );
    });
  });

  // =========================================================================
  // POST /payments/confirm
  // =========================================================================
  describe('confirmPayment', () => {
    const confirmDto = { paymentIntentId: 'pi_123', orderId: 'order-id' };

    it('should return confirmed payment response on success', async () => {
      const confirmedResponse = {
        ...mockPaymentResponse,
        success: true,
        data: { ...mockPaymentResponse.data, status: 'COMPLETED' as PaymentStatus, paymentMethod: 'card' },
        message: 'Payment confirmed successfully',
      };
      mockPaymentsService.confirmPayment.mockResolvedValue(confirmedResponse);

      const result = await controller.confirmPayment(confirmDto, USER_ID);

      expect(mockPaymentsService.confirmPayment).toHaveBeenCalledWith(USER_ID, confirmDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment confirmed successfully');
      expect(result.data.status).toBe('COMPLETED');
    });

    it('should return failed payment response when Stripe payment did not succeed', async () => {
      const failedResponse = {
        ...mockPaymentResponse,
        success: false,
        data: { ...mockPaymentResponse.data, status: 'FAILED' as PaymentStatus },
        message: 'Payment failed',
      };
      mockPaymentsService.confirmPayment.mockResolvedValue(failedResponse);

      const result = await controller.confirmPayment(confirmDto, USER_ID);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment failed');
      expect(result.data.status).toBe('FAILED');
    });

    it('should propagate NotFoundException when payment record is not found', async () => {
      mockPaymentsService.confirmPayment.mockRejectedValue(
        new NotFoundException('Payment record not found'),
      );

      await expect(controller.confirmPayment(confirmDto, USER_ID)).rejects.toThrow(
        new NotFoundException('Payment record not found'),
      );
    });

    it('should propagate ConflictException when payment is already confirmed', async () => {
      mockPaymentsService.confirmPayment.mockRejectedValue(
        new ConflictException('Payment has already been confirmed'),
      );

      await expect(controller.confirmPayment(confirmDto, USER_ID)).rejects.toThrow(
        new ConflictException('Payment has already been confirmed'),
      );
    });

    it('should pass userId from @GetUser decorator to the service', async () => {
      mockPaymentsService.confirmPayment.mockResolvedValue(mockPaymentResponse);

      await controller.confirmPayment(confirmDto, 'another-user-id');

      expect(mockPaymentsService.confirmPayment).toHaveBeenCalledWith('another-user-id', confirmDto);
    });
  });

  // =========================================================================
  // GET /payments
  // =========================================================================
  describe('findAll', () => {
    it('should return all payments for the logged-in user', async () => {
      const allPaymentsResponse = {
        success: true,
        data: [mockPaymentResponse.data],
      };
      mockPaymentsService.findAllByUser.mockResolvedValue(allPaymentsResponse);

      const result = await controller.findAll(USER_ID);

      expect(mockPaymentsService.findAllByUser).toHaveBeenCalledWith(USER_ID);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockPaymentResponse.data);
    });

    it('should return empty data array when user has no payments', async () => {
      mockPaymentsService.findAllByUser.mockResolvedValue({ success: true, data: [] });

      const result = await controller.findAll(USER_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return multiple payments', async () => {
      const secondPayment = {
        ...mockPaymentResponse.data,
        id: 'pay-id-2',
        orderId: 'order-id-2',
      };
      mockPaymentsService.findAllByUser.mockResolvedValue({
        success: true,
        data: [secondPayment, mockPaymentResponse.data],
      });

      const result = await controller.findAll(USER_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('pay-id-2');
      expect(result.data[1].id).toBe('pay-id');
    });

    it('should pass userId from @GetUser decorator to the service', async () => {
      mockPaymentsService.findAllByUser.mockResolvedValue({ success: true, data: [] });

      await controller.findAll('specific-user-id');

      expect(mockPaymentsService.findAllByUser).toHaveBeenCalledWith('specific-user-id');
    });
  });

  // =========================================================================
  // GET /payments/:id
  // =========================================================================
  describe('findById', () => {
    it('should return payment by ID for the logged-in user', async () => {
      mockPaymentsService.findById.mockResolvedValue(mockPaymentResponse);

      const result = await controller.findById('pay-id', USER_ID);

      expect(mockPaymentsService.findById).toHaveBeenCalledWith('pay-id', USER_ID);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('pay-id');
    });

    it('should propagate NotFoundException when payment is not found', async () => {
      mockPaymentsService.findById.mockRejectedValue(
        new NotFoundException('Payment not found'),
      );

      await expect(controller.findById('nonexistent-id', USER_ID)).rejects.toThrow(
        new NotFoundException('Payment not found'),
      );
    });

    it('should propagate NotFoundException when payment belongs to another user', async () => {
      mockPaymentsService.findById.mockRejectedValue(
        new NotFoundException('Payment not found'),
      );

      await expect(controller.findById('pay-id', 'other-user-id')).rejects.toThrow(NotFoundException);

      expect(mockPaymentsService.findById).toHaveBeenCalledWith('pay-id', 'other-user-id');
    });

    it('should pass both id param and userId from @GetUser decorator to the service', async () => {
      mockPaymentsService.findById.mockResolvedValue(mockPaymentResponse);

      await controller.findById('some-pay-id', 'some-user-id');

      expect(mockPaymentsService.findById).toHaveBeenCalledWith('some-pay-id', 'some-user-id');
    });
  });

  // =========================================================================
  // GET /payments/order/:orderId
  // =========================================================================
  describe('findByOrderId', () => {
    it('should return payment by order ID for the logged-in user', async () => {
      mockPaymentsService.findByOrderId.mockResolvedValue(mockPaymentResponse);

      const result = await controller.findByOrderId('order-id', USER_ID);

      expect(mockPaymentsService.findByOrderId).toHaveBeenCalledWith('order-id', USER_ID);
      expect(result.success).toBe(true);
      expect(result.data.orderId).toBe('order-id');
    });

    it('should propagate NotFoundException when no payment exists for the order', async () => {
      mockPaymentsService.findByOrderId.mockRejectedValue(
        new NotFoundException('Payment not found for this order'),
      );

      await expect(controller.findByOrderId('missing-order-id', USER_ID)).rejects.toThrow(
        new NotFoundException('Payment not found for this order'),
      );
    });

    it('should propagate NotFoundException when order belongs to another user', async () => {
      mockPaymentsService.findByOrderId.mockRejectedValue(
        new NotFoundException('Payment not found for this order'),
      );

      await expect(controller.findByOrderId('order-id', 'other-user-id')).rejects.toThrow(NotFoundException);

      expect(mockPaymentsService.findByOrderId).toHaveBeenCalledWith('order-id', 'other-user-id');
    });

    it('should pass both orderId param and userId from @GetUser decorator to the service', async () => {
      mockPaymentsService.findByOrderId.mockResolvedValue(mockPaymentResponse);

      await controller.findByOrderId('some-order-id', 'some-user-id');

      expect(mockPaymentsService.findByOrderId).toHaveBeenCalledWith('some-order-id', 'some-user-id');
    });
  });
});
