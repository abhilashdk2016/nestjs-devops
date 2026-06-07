import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDTO {
    @ApiProperty({
        description: 'Email address of the user',
        example: 'john.doe@example.com'
    })
    @IsEmail({}, { message: 'Please provide a valid email id' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @ApiProperty({
        description: 'Password of the user',
        example: 'P@ssw0rd'
    })
    @IsString()
    @IsNotEmpty({ message: 'Password is required' })
    password: string;
}