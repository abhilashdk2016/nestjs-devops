import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class QueryProductDTO {
    @ApiPropertyOptional({
        description: "Filter by category",
        example: "Electronics"
    })
    @IsString()
    @IsOptional()
    category?: string;

    @ApiPropertyOptional({
        description: "Filter by active product",
        example: true
    })
    @IsBoolean()
    @IsOptional()
    @Transform( ({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return undefined;
    })
    isActive?: boolean;

    @ApiPropertyOptional({
        description: "Search term to filter products by name or description",
        example: "laptop"
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        default: 1,
        minimum: 1
    })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    page = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 10,
        default: 10,
        minimum: 1
    })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    limit = 10;

}