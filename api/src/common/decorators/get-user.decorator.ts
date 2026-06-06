// Custom decorator to extract user from request
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
export const GetUser = createParamDecorator((data: string | undefined, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    return data ? user?.[data] : user;
});