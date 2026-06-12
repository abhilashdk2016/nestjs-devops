import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { PaymentStatus } from "@prisma/client";
import { ApiResponseDTO } from "@/common/dto/api-response.dto";

export class PaymentResponseDTO {
    @ApiProperty({ example: 'uuid-payment-id', description: 'Unique identifier of the payment' })
    @IsUUID()
    @IsNotEmpty()
    id: string;

    @ApiProperty({ example: 'uuid-user-id', description: 'ID of the user who made the payment' })
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ example: 'uuid-order-id', description: 'ID of the associated order' })
    @IsUUID()
    @IsNotEmpty()
    orderId: string;

    @ApiProperty({ example: 'USD', description: 'Currency code (ISO 4217)', default: 'USD' })
    @IsString()
    @IsNotEmpty()
    currency: string;

    @ApiProperty({ example: 250.00, description: 'Total amount paid', minimum: 0 })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    amountPaid: number;

    @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING, description: 'Current payment status' })
    @IsEnum(PaymentStatus)
    status: PaymentStatus;

    @ApiPropertyOptional({ example: 'card', description: 'Payment method used (e.g. card, paypal)' })
    @IsString()
    @IsOptional()
    paymentMethod?: string | null;

    @ApiPropertyOptional({ example: 'txn_3Ot2XyLkdIwHu7ix0Wt8BKCD', description: 'Transaction ID from the payment provider' })
    @IsString()
    @IsOptional()
    transactionId?: string | null;

    @ApiProperty({ example: '2024-01-01T12:00:00Z', description: 'Payment creation timestamp' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T12:00:00Z', description: 'Payment last updated timestamp' })
    updatedAt: Date;
}

export class CreatePaymentIntentResponse {
    @ApiProperty({ example: 'pi_3Ot2XyLkdIwHu7ix_secret_abc123', description: 'Client secret returned by the payment provider to confirm the payment on the frontend' })
    clientSecret: string;

    @ApiProperty({ example: 'uuid-payment-id', description: 'ID of the newly created payment record' })
    paymentId: string;
}

export class CreatePaymentIntentApiResponseDTO extends ApiResponseDTO(CreatePaymentIntentResponse) { }

export class PaymentApiResponseDTO extends ApiResponseDTO(PaymentResponseDTO) { }
