import { ApiProperty } from "@nestjs/swagger";
import { ApiResponseDTO } from "@/common/dto/api-response.dto";

export class CartItemResponseDTO {
    @ApiProperty({ example: 'uuid-cart-item-id' })
    id: string;

    @ApiProperty({ example: 'uuid-product-id' })
    productId: string;

    @ApiProperty({ example: 'Laptop' })
    productName: string;

    @ApiProperty({ example: 'https://example.com/image.png', nullable: true })
    productImageUrl: string | null;

    @ApiProperty({ example: 99.99, description: 'Unit price' })
    price: number;

    @ApiProperty({ example: 2 })
    quantity: number;

    @ApiProperty({ example: 199.98, description: 'price × quantity' })
    subTotal: number;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    updatedAt: Date;
}

export class CartResponseDTO {
    @ApiProperty({ example: 'uuid-cart-id' })
    id: string;

    @ApiProperty({ example: 'uuid-user-id' })
    userId: string;

    @ApiProperty({ example: false })
    checkedOut: boolean;

    @ApiProperty({ type: [CartItemResponseDTO] })
    items: CartItemResponseDTO[];

    @ApiProperty({ example: 299.97, description: 'Sum of all item subtotals' })
    total: number;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    updatedAt: Date;
}

export class CartApiResponseDTO extends ApiResponseDTO(CartResponseDTO) {}
