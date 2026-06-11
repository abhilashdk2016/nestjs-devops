import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class OrderItemDTO {
    @ApiProperty({ example: 'uuid-product-id', description: 'Product ID' })
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ example: 2, description: 'Quantity', minimum: 1 })
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity: number;

    @ApiProperty({ example: 99.99, description: 'Price per unit', minimum: 0 })
    @IsNumber({ maxDecimalPlaces: 2 }, { message: "Price must be a valid number" })
    @Min(0)
    @Type(() => Number)
    price: number;
}

export class CreateOrderDTO {
    @ApiProperty({ type: [OrderItemDTO], description: 'List of order items' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDTO)
    items: OrderItemDTO[];

    @ApiProperty({ example: '123 Main St, City, Country', description: 'Shipping address', required: false })
    @IsString()
    @IsOptional()
    shippingAddress?: string;
}
