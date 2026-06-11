import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class UpdateOrderItemDTO {
    @ApiPropertyOptional({ example: 'uuid-product-id', description: 'Product ID' })
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiPropertyOptional({ example: 2, description: 'Updated quantity', minimum: 1 })
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity: number;
}

export class UpdateUserOrderDTO {
    @ApiPropertyOptional({ example: '456 New Street, City, Country', description: 'Updated shipping address', maxLength: 500 })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    shippingAddress?: string;

    @ApiPropertyOptional({ example: 'Please leave at the door', description: 'Order notes', maxLength: 500 })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({ type: [UpdateOrderItemDTO], description: 'Updated list of order items — replaces existing items' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateOrderItemDTO)
    @IsOptional()
    items?: UpdateOrderItemDTO[];
}
