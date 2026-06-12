import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class UpdateCartItemDTO {
    @ApiProperty({ example: 3, description: 'New quantity for the cart item', minimum: 1 })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    quantity: number;
}
