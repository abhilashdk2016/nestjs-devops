import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class UpdateUserPasswordDTO {
    @ApiProperty({ 
        description: 'The current password of the user', 
        example: 'currentPassword123', 
        required: true 
    })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({ 
        description: 'The new password for the user', 
        example: 'newPassword123', 
        required: true,
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'New password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, { message: 'New Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' })
    newPassword: string;
}