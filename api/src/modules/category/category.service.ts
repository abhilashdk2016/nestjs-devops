import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { CategoryResponseDTO } from './dto/category-response.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Category, Prisma } from '@prisma/client';
import { QueryCategoryDTO } from './dto/query-category.dto';
import { UpdateCategoryDTO } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
    constructor(private prismaService: PrismaService) {}
    async createCategory(createCtaegoryDto: CreateCategoryDTO): Promise<CategoryResponseDTO> {
        const { name, slug, ...rest } = createCtaegoryDto;
        const categorySlug = slug ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const existingCategory = await this.prismaService.category.findUnique({
            where: {
                slug: categorySlug
            }
        });

        if(existingCategory) {
            throw new ConflictException('Category with this slug already exists: ' + categorySlug);
        }

        const category = await this.prismaService.category.create({
            data: {
                name,
                slug: categorySlug,
                ...rest
            }
        });

        return this.formatCategory(category, 0);
    }

    private formatCategory(category: Category, productCount: number): CategoryResponseDTO {
        return {
            id: category.id,
            name: category.name,
            description: category.description,
            slug: category.slug,
            imageUrl: category.imageUrl,
            isActive: category.isActive,
            productCount,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt

        }
    }

    // Get all categories
    async findAll(queryDto: QueryCategoryDTO): Promise<{
        data: CategoryResponseDTO[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        }
    }> {
        const { isActive, search, page = 1, limit = 10 } = queryDto;
        const where: Prisma.CategoryWhereInput = {};
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

        const total = await this.prismaService.category.count({ where });
        const categories = await this.prismaService.category.findMany({
            where,
            skip: (page -1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        return {
            data: categories.map(category => this.formatCategory(category, category._count.products )),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async findOne(id: string): Promise<CategoryResponseDTO> {
        const category = await this.prismaService.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        if(!category) {
            throw new NotFoundException("Specified category not found");
        }

        return this.formatCategory(category, Number(category._count.products));
    }

    async findOneBySlug(slug: string): Promise<CategoryResponseDTO> {
        const category = await this.prismaService.category.findUnique({
            where: { slug },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        if(!category) {
            throw new NotFoundException("Specified category not found");
        }

        return this.formatCategory(category, Number(category._count.products));
    }

    async update(id: string, updateCategoryDto: UpdateCategoryDTO): Promise<CategoryResponseDTO> {
        const existingCategory = await this.prismaService.category.findUnique({
            where: { id }
        });
        if(!existingCategory) {
            throw new NotFoundException("Specified category not found");
        }
        if(updateCategoryDto.slug && updateCategoryDto.slug !== existingCategory.slug) {
            const slugTaken = await this.prismaService.category.findUnique({
                where: { slug: updateCategoryDto.slug }
            });
            if(!slugTaken) {
                throw new ConflictException("Category with slug already exists");
            }
        }
        const updatedCategory = await this.prismaService.category.update({
            where: { id },
            data: updateCategoryDto,
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        return this.formatCategory(updatedCategory, Number(updatedCategory._count.products));
    }

    async remove(id: string): Promise<{ message: string}> {
        const category = await this.prismaService.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        if (!category) {
            throw new NotFoundException('Category not found');
        }
        if(category._count.products > 0) {
            throw new BadRequestException(`Cannot delete category with ${category._count.products} products. Remove or reassign first`);
        }
        
        await this.prismaService.category.delete({ 
            where : { id }
        });
        return { message: "Category deleted succesfully" };
    }
}
