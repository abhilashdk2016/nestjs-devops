import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateProductDTO {
    @ApiProperty({
        description: "Product name",
        example: "Laptop",
        maxLength: 200
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name: string;

    @ApiProperty({
        description: "Details of the product",
        required: false,
        example: "A high end computing machine"
    })
    description?: string;

    @ApiProperty({
        description: "Price of the product",
        required: true,
        example: 100,
        minimum: 0
    })
    @IsNumber({
        maxDecimalPlaces: 2
    })
    @Min(0)
    @Type(() => Number)
    price: number;

    @ApiProperty({
        description: "Available quantity of the product",
        required: true,
        example: 100,
        minimum: 0
    })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    stock: number;

    @ApiProperty({
        description: "Stock keeping Unit - unique identifier",
        example: "WH-1009",
        maxLength: 50,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    sku: string;

    @ApiProperty({ 
        example: "https://example.com/images/apple-mabook-pro.png",
        description: 'URL of the image representing the product',
        maxLength: 300,
        required: false
    })
    @IsString()
    @MaxLength(300)
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({
        description: "Product category",
        example: "Electronics",
        required: true
    })
    @IsString()
    @IsNotEmpty()
    categoryId: string

    @ApiProperty({ 
        example: true,
        description: 'Indicates if product is active',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}