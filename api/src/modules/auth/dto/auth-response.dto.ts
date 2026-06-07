import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class AuthResponseDTO {
    @ApiProperty({
        description: 'Access token for authentication',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    })
    accessToken: string;
    @ApiProperty({
        description: 'Refresh token for obtaining new access tokens',
        example: 'd1f1e1c1-2a3b-4c5d-6e7f-8g9h0i1j2k3l'
    })
    refreshToken: string;
    @ApiProperty({
        description: 'User information',
        example: {
            id: '1234567890',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'USER'
        }
    })
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: Role;
    }
}