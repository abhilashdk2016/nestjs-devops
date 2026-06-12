import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDTO } from './dto/create-payment-intent.dto';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { CreatePaymentIntentApiResponseDTO, PaymentApiResponseDTO, PaymentResponseDTO } from './dto/payment-response.dto';
import { ConfirmPaymentDTO } from './dto/confirm-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGaurd)
@ApiTags("payments")
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
    constructor(private readonly paymentService: PaymentsService) { }

    @Post("create-intent")
    @ApiOperation({ summary: 'create payment intent', description: 'Create a payment intent for an order' })
    @ApiCreatedResponse({
        description: 'Payment intent created',
        type: CreatePaymentIntentApiResponseDTO
    })
    @ApiBadRequestResponse({
        description: "invalid data or order not found"
    })
    async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDTO, @GetUser('id') userId: string): Promise<CreatePaymentIntentApiResponseDTO> {
        return await this.paymentService.createPaymentIntent(userId, createPaymentIntentDto);
    }

    @Post('confirm')
    @ApiOperation({
        summary: "Confirm payment",
        description: "Confirm a payment intent for an order"
    })
    @ApiResponse({
        status: 200,
        description: "Payment confirmed successfully",
        type: PaymentApiResponseDTO
    })
    @ApiBadRequestResponse({
        description: "Payment not found or already completed"
    })
    async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDTO, @GetUser('id') userId: string): Promise<PaymentApiResponseDTO> {
        return await this.paymentService.confirmPayment(userId, confirmPaymentDto)
    }

    @Get()
    @ApiOperation({ summary: 'Get all payments for the logged-in user' })
    @ApiResponse({ status: 200, description: 'List of payments', type: PaymentApiResponseDTO, isArray: true })
    async findAll(@GetUser('id') userId: string): Promise<{ success: boolean; data: PaymentResponseDTO[] }> {
        return this.paymentService.findAllByUser(userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a payment by ID' })
    @ApiResponse({ status: 200, description: 'Payment details', type: PaymentApiResponseDTO })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async findById(
        @Param('id') id: string,
        @GetUser('id') userId: string
    ): Promise<PaymentApiResponseDTO> {
        return this.paymentService.findById(id, userId);
    }

    @Get('order/:orderId')
    @ApiOperation({ summary: 'Get payment by order ID' })
    @ApiResponse({ status: 200, description: 'Payment details for the order', type: PaymentApiResponseDTO })
    @ApiResponse({ status: 404, description: 'Payment not found for this order' })
    async findByOrderId(
        @Param('orderId') orderId: string,
        @GetUser('id') userId: string
    ): Promise<PaymentApiResponseDTO> {
        return this.paymentService.findByOrderId(orderId, userId);
    }
}
