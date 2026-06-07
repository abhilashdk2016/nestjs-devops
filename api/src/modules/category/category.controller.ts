import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { Roles } from '@/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CreateCategoryDTO } from './dto/create-category.dto';
import { CategoryResponseDTO } from './dto/category-response.dto';
import { QueryCategoryDTO } from './dto/query-category.dto';
import { UpdateCategoryDTO } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Post()
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Create a new category'})
    @ApiBody({ type: CreateCategoryDTO })
    @ApiResponse({ status: 201, description: 'Category created successfully'})
    @ApiResponse({ status: 400, description: 'Invalid input data'})
    @ApiResponse({ status: 401, description: 'Unauthorized'})
    @ApiResponse({ status: 403, description: 'Forbidden'})
    async createcategory(@Body() createCategoryDto: CreateCategoryDTO): Promise<CategoryResponseDTO> {
        return this.categoryService.createCategory(createCategoryDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all categories' })
    @ApiResponse({ status: 201, description: 'Category list retrived successfully', schema: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/CategoryResponseDTO'}
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
    async findAll(@Query() queryDto: QueryCategoryDTO) {
        return await this.categoryService.findAll(queryDto);
    }

    @Get(":id")
    @ApiOperation({ summary: 'Get a particular category based on id'})
    @ApiResponse({ status: 200, description: 'Category Details', type: CategoryResponseDTO})
    @ApiResponse({ status: 404, description: 'Category Not found'})
    async findOne(@Param('id') id: string): Promise<CategoryResponseDTO> {
        return await this.categoryService.findOne(id);
    }

    @Get("slug/:slug")
    @ApiOperation({ summary: 'Get a particular category based on slug'})
    @ApiResponse({ status: 200, description: 'Category Details', type: CategoryResponseDTO})
    @ApiResponse({ status: 404, description: 'Category Not found'})
    async findOneBySlug(@Param('slug') slug: string): Promise<CategoryResponseDTO> {
        return await this.categoryService.findOneBySlug(slug);
    }

    @Patch(":id")
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiBearerAuth("JWT-auth")
    @ApiOperation({ summary: 'Update category - Admin'})
    @ApiBody({
        type: UpdateCategoryDTO
    })
    @ApiResponse({ status: 200, description: 'Updated Category Details', type: CategoryResponseDTO})
    @ApiResponse({ status: 404, description: 'Category Not found'})
    async update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDTO): Promise<CategoryResponseDTO> {
        return await this.categoryService.update(id, updateCategoryDto);
    }

    @Delete(":id")
    @UseGuards(JwtAuthGaurd, RolesGaurd)
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth("JWT-auth")
    @ApiOperation({ summary: "Delete category by id"})
    @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deleteUserByAdmin(@Param('id') id: string): Promise<{ message: string}> {
        return this.categoryService.remove(id);
    }
}
