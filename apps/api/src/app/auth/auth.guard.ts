import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../store/model';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & { user?: User };

/** Verlangt ein gültiges Bearer-Token und hinterlegt den Benutzer am Request. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = this.auth.authenticate(request.headers.authorization);
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AuthenticatedRequest>().user as User,
);
