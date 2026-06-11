import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "@nestjs/common";

export function ApiResponseDTO<T>(DataClass: Type<T>) {
    class ApiResponse {
        @ApiProperty({ example: true, description: 'Indicates if the request was successful' })
        success: boolean;

        @ApiProperty({ type: () => DataClass, description: 'Response payload' })
        data: T;

        @ApiPropertyOptional({ example: 'Operation completed successfully', description: 'Optional message' })
        message?: string;
    }

    Object.defineProperty(ApiResponse, 'name', { value: `ApiResponseDTO_${DataClass.name}` });
    return ApiResponse;
}

export type ApiResponseType<T> = InstanceType<ReturnType<typeof ApiResponseDTO<T>>>;
