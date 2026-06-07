import { ProductsService } from './products.service';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { Roles } from '@/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CreateProductDTO } from './dto/create-product.dto';
import { ProductResponseDTO } from './dto/product-response.dto';
import { QueryProductDTO } from './dto/query-product.dto';
import { UpdateProductDTO } from './dto/update-product.dto';

@ApiTags("products")
@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}

    @Post()
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Create a new product'})
    @ApiBody({ type: CreateProductDTO })
    @ApiResponse({ status: 201, description: 'Product created successfully'})
    @ApiResponse({ status: 400, description: 'Invalid input data'})
    @ApiResponse({ status: 401, description: 'Unauthorized'})
    @ApiResponse({ status: 403, description: 'Forbidden'})
    async createcategory(@Body() createProductDto: CreateProductDTO): Promise<ProductResponseDTO> {
        return this.productsService.create(createProductDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all products with optional filters' })
    @ApiResponse({ status: 201, description: 'Product list with pagination', schema: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/ProductResponseDTO'}
            },
            meta: {
                type: 'object',
                properties: {
                    total: { type: 'integer' },
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    totalPages: { type: 'number' }
                }
            }
        }
    }})
    @ApiResponse({ status: 400, description: 'Invalid input data'})
    @ApiResponse({ status: 401, description: 'Unauthorized'})
    @ApiResponse({ status: 403, description: 'Forbidden'})
    async findAll(@Query() queryDto: QueryProductDTO) {
        return await this.productsService.findAll(queryDto);
    }

    @Get(":id")
    @ApiOperation({ summary: 'Get a particular product based on id'})
    @ApiResponse({ status: 200, description: 'Product Details', type: ProductResponseDTO})
    @ApiResponse({ status: 404, description: 'Product Not found'})
    async findOne(@Param('id') id: string): Promise<ProductResponseDTO> {
        return await this.productsService.findOne(id);
    }

    @Get("sku/:sku")
    @ApiOperation({ summary: 'Get a particular product based on slug'})
    @ApiResponse({ status: 200, description: 'Product Details', type: ProductResponseDTO})
    @ApiResponse({ status: 404, description: 'Product Not found'})
    async findOneBySku(@Param('sku') sku: string): Promise<ProductResponseDTO> {
        return await this.productsService.findOneBySku(sku);
    }

    @Patch(":id")
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiBearerAuth("JWT-auth")
    @ApiOperation({ summary: 'Update product - Admin'})
    @ApiBody({
        type: UpdateProductDTO
    })
    @ApiResponse({ status: 200, description: 'Updated Product Details', type: ProductResponseDTO})
    @ApiResponse({ status: 404, description: 'Product Not found'})
    async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDTO): Promise<ProductResponseDTO> {
        return await this.productsService.update(id, updateProductDto);
    }

    @Patch(":id/stock")
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiBearerAuth("JWT-auth")
    @ApiOperation({ summary: 'Update product - Admin'})
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                quantity: {
                    type: "number",
                    description: "Stock adjustment",
                    example: 10,
                }
            },
            required: ["quantity"]
        }
    })
    @ApiResponse({ status: 200, description: 'Updated Product Stock Details', type: ProductResponseDTO})
    @ApiResponse({ status: 400, description: 'InSufficient Stock', type: ProductResponseDTO})
    @ApiResponse({ status: 404, description: 'Product Not found'})
    async updateStock(@Param('id') id: string, @Body('quantity') quantity: number): Promise<ProductResponseDTO> {
        return await this.productsService.updateStock(id, quantity);
    }

    @Delete(":id")
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth("JWT-auth")
    @ApiOperation({ summary: "Delete product by id"})
    @ApiResponse({ status: 200, description: 'Product deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deleteUserByAdmin(@Param('id') id: string): Promise<{ message: string}> {
        return this.productsService.remove(id);
    }
}
