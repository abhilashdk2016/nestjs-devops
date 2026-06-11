import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { OrderStatus } from "@prisma/client";

export class UpdateOrderDTO {
    @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PROCESSING, description: 'New order status' })
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @ApiPropertyOptional({ example: 'TRACK-123456', description: 'Shipment tracking number', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    trackingNumber?: string;

    @ApiPropertyOptional({ example: 'Left at front door', description: 'Internal notes for the order', maxLength: 500 })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string;
}
