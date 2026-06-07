import { ApiProperty } from "@nestjs/swagger";

export class ProductResponseDTO {
    @ApiProperty({ example: '34646-detyry-546457-tyhhh', description: 'The unique identifier of the product'})
    id: string;

    @ApiProperty({ 
        example: 'Laptop',
        description: 'The name of the product',
    })
    name: string;

    @ApiProperty({
        example: 'Devices and gadgets',
        description: 'A brief description of the product',
        nullable: true
    })
    description: string | null;

    @ApiProperty({
        description: "Price of the product",
        example: 100,
    })
    price: number;

    @ApiProperty({
        description: "Available quantity of the product",
        example: 100
    })
    stock: number;

    @ApiProperty({
        description: "Stock keeping Unit - unique identifier",
        example: "WH-1009"
    })
    sku: string;

    @ApiProperty({
        example: "https://example.com/images/electronics.png",
        description: 'URL of the image representing product',
        nullable: true
    })
    imageUrl: string | null;

    @ApiProperty({
        description: "Product category",
        example: "Electronics",
    })
    category: string | null

    @ApiProperty({ 
        example: true,
        description: 'Indicates if product is active'
    })
    isActive: boolean;

    @ApiProperty({
        example: '2024-01-01T12:00:00Z',
        description: 'The date and time when the product was created'
    })
    createdAt: Date

    @ApiProperty({
        example: '2024-01-01T12:00:00Z',
        description: 'The date and time when the product was updated'
    })
    updatedAt: Date;
}