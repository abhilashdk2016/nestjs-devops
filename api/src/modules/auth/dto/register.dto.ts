import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterDTO {
    @ApiProperty({
        description: 'Email address of the user',
        example: 'john.doe@example.com',
        required: true
    })
    @IsEmail({}, { message: 'Invalid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @ApiProperty({
        description: 'Password of the user',
        example: 'P@ssw0rd',
        required: true
    })
    @IsString()
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' })
    password: string;

    @ApiProperty({
        description: 'First name of the user',
        example: 'John',
        required: false
    })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({
        description: 'Last name of the user',
        example: 'Doe',
        required: false
    })
    @IsOptional()
    @IsString()
    lastName?: string;
}