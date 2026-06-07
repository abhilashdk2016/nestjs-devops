import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";

export class UpdateUserDTO {
    @ApiProperty({ 
        description: 'The email address of the user', 
        example: 'john.doe@example.com',
        required: false, 
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'The first name of the user', example: 'John', required: false })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ description: 'The last name of the user', example: 'Doe', required: false })
    @IsOptional()
    @IsString()
    lastName?: string;
}