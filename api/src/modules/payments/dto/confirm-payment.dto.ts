import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ConfirmPaymentDTO {
    @ApiProperty({ example: 'pi_3Ot2XyLkdIwHu7ix0Wt8BKCD', description: 'Stripe PaymentIntent ID returned from the create-intent step' })
    @IsNotEmpty()
    @IsString()
    paymentIntentId: string;

    @ApiProperty({ example: 'uuid-order-id', description: 'ID of the order being paid for' })
    @IsNotEmpty()
    @IsString()
    orderId: string;
}