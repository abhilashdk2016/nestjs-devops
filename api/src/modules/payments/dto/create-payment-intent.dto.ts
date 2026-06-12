import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePaymentIntentDTO {
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @IsOptional()
    @IsString()
    currency?: string = 'usd';

    @IsOptional()
    @IsString()
    description?: string;
}