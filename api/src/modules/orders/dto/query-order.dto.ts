import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { OrderStatus } from "@prisma/client";

export class QueryOrderDTO {
    @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING, description: 'Filter by order status' })
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @ApiPropertyOptional({ example: 'uuid-user-id', description: 'Filter by user ID (Admin only)' })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiPropertyOptional({ example: 'ORD-123', description: 'Search by order number or shipping address' })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ example: 1, default: 1, minimum: 1, description: 'Page number for pagination' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    page = 1;

    @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, description: 'Number of items per page' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    limit = 10;
}
