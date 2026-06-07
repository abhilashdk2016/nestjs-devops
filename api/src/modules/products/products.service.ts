import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Category, Prisma, Product } from '@prisma/client';
import { ProductResponseDTO } from './dto/product-response.dto';
import { CreateProductDTO } from './dto/create-product.dto';
import { QueryProductDTO } from './dto/query-product.dto';
import { UpdateProductDTO } from './dto/update-product.dto';
@Injectable()
export class ProductsService {
    constructor(private prismaService: PrismaService) {}
    async create(createProductDto: CreateProductDTO): Promise<ProductResponseDTO> {
        const existingProduct = await this.prismaService.product.findUnique({
            where: {
                sku: createProductDto.sku
            }
        });

        if(existingProduct) {
            throw new ConflictException('Product already exists');
        }

        const product = await this.prismaService.product.create({
            data: {
                ...createProductDto,
                price: new Prisma.Decimal(createProductDto.price)
            },
            include: {
                category: true
            }
        });

        return this.formatProduct(product);
    }

    private formatProduct(product: Product & { category: Category}): ProductResponseDTO {
        return {
            ...product,
            price: Number(product.price),
            category: product.category.name
        }
    }

    // Get all products
    async findAll(queryDto: QueryProductDTO): Promise<{
        data: ProductResponseDTO[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        }
    }> {
        const { isActive, search, page = 1, limit = 10, category } = queryDto;
        const where: Prisma.ProductWhereInput = {};
        if(category) {
            where.categoryId = category;
        }
        if(isActive !== undefined) {
            where.isActive = isActive;
        }
        if(search) {
            where.OR = [
                {
                    name: {
                        contains: search, mode: 'insensitive'
                    },
                    description: {
                        contains: search, mode: 'insensitive'
                    }
                }
            ];
        }

        const total = await this.prismaService.product.count({ where });
        const products = await this.prismaService.product.findMany({
            where,
            skip: (page -1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                category: true
            }
        });

        return {
            data: products.map(product => this.formatProduct(product)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findOne(id: string): Promise<ProductResponseDTO> {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                category: true
            }
        });
        if(!product) {
            throw new NotFoundException("Specified product not found");
        }

        return this.formatProduct(product);
    }

    async findOneBySku(sku: string): Promise<ProductResponseDTO> {
        const product = await this.prismaService.product.findUnique({
            where: { sku },
            include: {
                category: true
            }
        });
        if(!product) {
            throw new NotFoundException("Specified product not found");
        }

        return this.formatProduct(product);
    }

    async update(id: string, updateProductDto: UpdateProductDTO): Promise<ProductResponseDTO> {
        const existingProduct = await this.prismaService.product.findUnique({
            where: { id }
        });
        if(!existingProduct) {
            throw new NotFoundException("Specified product not found");
        }
        if(updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
            const skuTaken = await this.prismaService.product.findUnique({
                where: { sku: updateProductDto.sku }
            });
            if(!skuTaken) {
                throw new ConflictException("Product with sku already exists");
            }
        }
        const updatedProductData: any = { ...updateProductDto };
        if(updatedProductData.price !== undefined) {
            updatedProductData.price = new Prisma.Decimal(updatedProductData.price);
        }
        const updatedProduct = await this.prismaService.product.update({
            where: { id },
            data: updatedProductData,
            include: {
                category: true
            }
        });

        return this.formatProduct(updatedProduct);
    }

    async updateStock(id: string, quantity: number): Promise<ProductResponseDTO> {
        const existingProduct = await this.prismaService.product.findUnique({
            where: { id }
        });
        if(!existingProduct) {
            throw new NotFoundException("Specified product not found");
        }
        const newStock = existingProduct.stock + quantity;
        if(newStock < 0) {
            throw new BadRequestException("tock cannot be negative");
        }
        const updatedProduct = await this.prismaService.product.update({
            where: { id },
            data: { stock: newStock },
            include: {
                category: true
            }
        });

        return this.formatProduct(updatedProduct);
    }

    async remove(id: string): Promise<{ message: string}> {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                category: true
            }
        });
        if (!product) {
            throw new NotFoundException('Product not found');
        }
        
        await this.prismaService.product.delete({ 
            where : { id }
        });
        return { message: "Product deleted succesfully" };
    }
}
