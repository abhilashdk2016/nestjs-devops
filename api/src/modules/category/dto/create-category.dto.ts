import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCategoryDTO {
    @ApiProperty({ 
        example: "Clothing",
        description: 'The name of the category',
        maxLength: 100,
        required: true
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({ 
        example: "Cloths for men and woman",
        description: 'A brief description of category',
        maxLength: 255,
        required: false
    })
    @IsString()
    @MaxLength(255)
    @IsOptional()
    description?: string;

    @ApiProperty({ 
        example: "clothing",
        description: 'URL friendly slug for category',
        maxLength: 100,
        required: false
    })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    slug?: string;

    @ApiProperty({ 
        example: "https://example.com/images/clothing.png",
        description: 'URL of the image representing category',
        maxLength: 300,
        required: false
    })
    @IsString()
    @MaxLength(300)
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ 
        example: true,
        description: 'Indicates if category is active',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;


}