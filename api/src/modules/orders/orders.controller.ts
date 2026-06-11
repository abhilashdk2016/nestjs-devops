import { OrdersService } from './orders.service';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { RolesGaurd } from '@/common/gaurds/roles.gaurd';
import { Roles } from '@/common/decorators/role.decorator';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { CreateOrderDTO } from './dto/create-order.dto';
import { OrderResponseDTO } from './dto/order-response.dto';
import { QueryOrderDTO } from './dto/query-order.dto';
import { UpdateOrderDTO } from './dto/update-order-status.dto';
import { UpdateUserOrderDTO } from './dto/update-user-order.dto';
import { ThrottleLenient, ThrottleModerate } from '@/common/decorators/custom-throttler.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGaurd, RolesGaurd)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    @ThrottleModerate()
    @ApiOperation({ summary: 'Create a new order' })
    @ApiBody({ type: CreateOrderDTO })
    @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDTO })
    @ApiResponse({ status: 400, description: 'Invalid input or insufficient stock' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async create(
        @GetUser('id') userId: string,
        @Body() createOrderDto: CreateOrderDTO
    ): Promise<OrderResponseDTO> {
        return this.ordersService.create(userId, createOrderDto);
    }

    @Get()
    @ThrottleLenient()
    @ApiOperation({ summary: 'Get all orders (Admin sees all, User sees own)' })
    @ApiResponse({
        status: 200, description: 'Order list with pagination', schema: {
            type: 'object',
            properties: {
                data: { type: 'array', items: { $ref: '#/components/schemas/OrderResponseDTO' } },
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
        }
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async findAll(
        @GetUser('id') userId: string,
        @GetUser('role') role: Role,
        @Query() queryDto: QueryOrderDTO
    ) {
        return this.ordersService.findAll(userId, role, queryDto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific order by ID' })
    @ApiResponse({ status: 200, description: 'Order details', type: OrderResponseDTO })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async findOne(
        @Param('id') id: string,
        @GetUser('id') userId: string,
        @GetUser('role') role: Role
    ): Promise<OrderResponseDTO> {
        return this.ordersService.findOne(id, userId, role);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update own order - shipping address or items (PENDING only)' })
    @ApiBody({ type: UpdateUserOrderDTO })
    @ApiResponse({ status: 200, description: 'Updated order details', type: OrderResponseDTO })
    @ApiResponse({ status: 400, description: 'Order is not in PENDING status' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async updateUserOrder(
        @Param('id') id: string,
        @GetUser('id') userId: string,
        @Body() updateUserOrderDto: UpdateUserOrderDTO
    ): Promise<OrderResponseDTO> {
        return this.ordersService.updateUserOrder(id, userId, updateUserOrderDto);
    }

    @Patch(':id/status')
    @UseGuards(RolesGaurd)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update order status - Admin only' })
    @ApiBody({ type: UpdateOrderDTO })
    @ApiResponse({ status: 200, description: 'Updated order details', type: OrderResponseDTO })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async update(
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateOrderDTO
    ): Promise<OrderResponseDTO> {
        return this.ordersService.update(id, updateStatusDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel an order' })
    @ApiResponse({ status: 200, description: 'Order cancelled successfully', type: OrderResponseDTO })
    @ApiResponse({ status: 400, description: 'Cannot cancel order in current status' })
    @ApiResponse({ status: 403, description: 'Forbidden' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async remove(
        @Param('id') id: string,
        @GetUser('id') userId: string,
        @GetUser('role') role: Role
    ): Promise<OrderResponseDTO> {
        return this.ordersService.remove(id, userId, role);
    }
}
