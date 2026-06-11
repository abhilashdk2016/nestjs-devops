import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { ApiResponseDTO } from "@/common/dto/api-response.dto";

export class OrderItemResponseDTO {
    @ApiProperty({ example: 'uuid-item-id' })
    id: string;

    @ApiProperty({ example: 2 })
    quatity: number;

    @ApiProperty({ example: 100.00 })
    price: number;

    @ApiProperty({ example: 100.00 })
    subTotal: number;

    @ApiProperty({ example: 'uuid-product-id' })
    productId: string;

    @ApiProperty({ example: 'laptop' })
    productName: string;

    @ApiProperty({ example: 'uuid-order-id' })
    orderId: string;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    updatedAt: Date;
}

export class OrderData {
    @ApiProperty({ example: 'uuid-order-id', description: 'The unique identifier of the order' })
    id: string;

    @ApiProperty({ example: 'clxyz123abc', description: 'Human-readable order number' })
    orderNumber: string;

    @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
    status: OrderStatus;

    @ApiProperty({ example: 250.00 })
    totalAmount: number;

    @ApiProperty({ example: 'uuid-user-id' })
    userId: string;

    @ApiProperty({ example: '123 Main St, City, Country', nullable: true })
    shippingAddress: string | null;

    @ApiProperty({ type: [OrderItemResponseDTO] })
    orderItems: OrderItemResponseDTO[];

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T12:00:00Z' })
    updatedAt: Date;
}

export class OrderResponseDTO extends ApiResponseDTO(OrderData) { }
