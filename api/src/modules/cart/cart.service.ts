import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Cart, CartItem, Product } from '@prisma/client';
import { AddCartItemDTO } from './dto/add-cart-item.dto';
import { UpdateCartItemDTO } from './dto/update-cart-item.dto';
import { CartApiResponseDTO, CartResponseDTO } from './dto/cart-response.dto';

type CartWithItems = Cart & {
    cartItems: (CartItem & { product: Product })[];
};

@Injectable()
export class CartService {
    constructor(private prismaService: PrismaService) {}

    async getCart(userId: string): Promise<CartApiResponseDTO> {
        const cart = await this.findOrCreateCart(userId);
        return { success: true, data: this.toCartData(cart) };
    }

    async addItem(userId: string, dto: AddCartItemDTO): Promise<CartApiResponseDTO> {
        const product = await this.prismaService.product.findUnique({
            where: { id: dto.productId, isActive: true }
        });

        if (!product) {
            throw new NotFoundException('Product not found or inactive');
        }

        if (product.stock < dto.quantity) {
            throw new BadRequestException(`Insufficient stock for product: ${product.name}`);
        }

        const cart = await this.findOrCreateCart(userId);

        const existingItem = cart.cartItems.find(i => i.productId === dto.productId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + dto.quantity;
            if (product.stock < newQuantity) {
                throw new BadRequestException(`Insufficient stock. Available: ${product.stock}`);
            }
            await this.prismaService.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQuantity }
            });
        } else {
            await this.prismaService.cartItem.create({
                data: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity }
            });
        }

        const updatedCart = await this.fetchCart(cart.id);
        return { success: true, data: this.toCartData(updatedCart) };
    }

    async updateItem(userId: string, itemId: string, dto: UpdateCartItemDTO): Promise<CartApiResponseDTO> {
        const cart = await this.findOrCreateCart(userId);

        const item = cart.cartItems.find(i => i.id === itemId);
        if (!item) {
            throw new NotFoundException('Cart item not found');
        }

        if (item.product.stock < dto.quantity) {
            throw new BadRequestException(`Insufficient stock. Available: ${item.product.stock}`);
        }

        await this.prismaService.cartItem.update({
            where: { id: itemId },
            data: { quantity: dto.quantity }
        });

        const updatedCart = await this.fetchCart(cart.id);
        return { success: true, data: this.toCartData(updatedCart) };
    }

    async removeItem(userId: string, itemId: string): Promise<CartApiResponseDTO> {
        const cart = await this.findOrCreateCart(userId);

        const item = cart.cartItems.find(i => i.id === itemId);
        if (!item) {
            throw new NotFoundException('Cart item not found');
        }

        await this.prismaService.cartItem.delete({ where: { id: itemId } });

        const updatedCart = await this.fetchCart(cart.id);
        return { success: true, data: this.toCartData(updatedCart), message: 'Item removed from cart' };
    }

    async clearCart(userId: string): Promise<{ success: boolean; message: string }> {
        const cart = await this.prismaService.cart.findFirst({
            where: { userId, checkedOut: false }
        });

        if (!cart) {
            throw new NotFoundException('No active cart found');
        }

        await this.prismaService.cartItem.deleteMany({ where: { cartId: cart.id } });

        return { success: true, message: 'Cart cleared successfully' };
    }

    private async findOrCreateCart(userId: string): Promise<CartWithItems> {
        const existing = await this.prismaService.cart.findFirst({
            where: { userId, checkedOut: false },
            include: { cartItems: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });

        if (existing) return existing;

        return this.prismaService.cart.create({
            data: { userId },
            include: { cartItems: { include: { product: true } } }
        });
    }

    private async fetchCart(cartId: string): Promise<CartWithItems> {
        return this.prismaService.cart.findUnique({
            where: { id: cartId },
            include: { cartItems: { include: { product: true } } }
        });
    }

    private toCartData(cart: CartWithItems): CartResponseDTO {
        const items = cart.cartItems.map(item => ({
            id: item.id,
            productId: item.productId,
            productName: item.product.name,
            productImageUrl: item.product.imageUrl,
            price: Number(item.product.price),
            quantity: item.quantity,
            subTotal: Number(item.product.price) * item.quantity,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }));

        return {
            id: cart.id,
            userId: cart.userId,
            checkedOut: cart.checkedOut,
            items,
            total: items.reduce((sum, i) => sum + i.subTotal, 0),
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
        };
    }
}
