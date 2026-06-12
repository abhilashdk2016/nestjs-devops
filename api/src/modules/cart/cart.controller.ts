import { CartService } from './cart.service';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGaurd } from '@/common/gaurds/jwt-auth.gaurd';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { AddCartItemDTO } from './dto/add-cart-item.dto';
import { UpdateCartItemDTO } from './dto/update-cart-item.dto';
import { CartApiResponseDTO } from './dto/cart-response.dto';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGaurd)
@ApiBearerAuth('JWT-auth')
export class CartController {
    constructor(private readonly cartService: CartService) {}

    @Get()
    @ApiOperation({ summary: 'Get the active cart for the logged-in user' })
    @ApiResponse({ status: 200, description: 'Active cart with items', type: CartApiResponseDTO })
    async getCart(@GetUser('id') userId: string): Promise<CartApiResponseDTO> {
        return this.cartService.getCart(userId);
    }

    @Post('items')
    @ApiOperation({ summary: 'Add a product to the cart' })
    @ApiBody({ type: AddCartItemDTO })
    @ApiResponse({ status: 201, description: 'Item added to cart', type: CartApiResponseDTO })
    @ApiResponse({ status: 400, description: 'Insufficient stock' })
    @ApiResponse({ status: 404, description: 'Product not found' })
    async addItem(
        @GetUser('id') userId: string,
        @Body() dto: AddCartItemDTO
    ): Promise<CartApiResponseDTO> {
        return this.cartService.addItem(userId, dto);
    }

    @Patch('items/:itemId')
    @ApiOperation({ summary: 'Update the quantity of a cart item' })
    @ApiBody({ type: UpdateCartItemDTO })
    @ApiResponse({ status: 200, description: 'Cart item updated', type: CartApiResponseDTO })
    @ApiResponse({ status: 400, description: 'Insufficient stock' })
    @ApiResponse({ status: 404, description: 'Cart item not found' })
    async updateItem(
        @GetUser('id') userId: string,
        @Param('itemId') itemId: string,
        @Body() dto: UpdateCartItemDTO
    ): Promise<CartApiResponseDTO> {
        return this.cartService.updateItem(userId, itemId, dto);
    }

    @Delete('items/:itemId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove an item from the cart' })
    @ApiResponse({ status: 200, description: 'Item removed from cart', type: CartApiResponseDTO })
    @ApiResponse({ status: 404, description: 'Cart item not found' })
    async removeItem(
        @GetUser('id') userId: string,
        @Param('itemId') itemId: string
    ): Promise<CartApiResponseDTO> {
        return this.cartService.removeItem(userId, itemId);
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Clear all items from the active cart' })
    @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
    @ApiResponse({ status: 404, description: 'No active cart found' })
    async clearCart(
        @GetUser('id') userId: string
    ): Promise<{ success: boolean; message: string }> {
        return this.cartService.clearCart(userId);
    }
}
