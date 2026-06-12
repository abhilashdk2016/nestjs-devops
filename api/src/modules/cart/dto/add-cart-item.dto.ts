import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class AddCartItemDTO {
    @ApiProperty({ example: 'uuid-product-id', description: 'Product to add to the cart' })
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ example: 1, description: 'Quantity to add', minimum: 1, default: 1 })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    quantity: number = 1;
}
