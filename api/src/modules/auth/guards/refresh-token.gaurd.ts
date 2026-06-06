import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
@Injectable()
export class RefreshTokenGaurd extends AuthGuard('jwt-refresh') {

}