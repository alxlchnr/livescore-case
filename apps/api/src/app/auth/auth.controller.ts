import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { User } from '../store/model';
import { UsersService } from '../users/users.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('v2/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return this.users.details(user);
  }
}
