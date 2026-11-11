import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AccessService } from '../auth/access.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { User } from '../store/model';
import { UsersService } from '../users/users.service';
import { TeamsService } from './teams.service';

@Controller('v1')
export class TeamsV1Controller {
  constructor(
    private readonly teams: TeamsService,
    private readonly users: UsersService,
  ) {}

  @Get('teams')
  list() {
    return this.teams.list();
  }

  @Get('teams/:id')
  get(@Param('id') id: string) {
    return this.teams.get(id);
  }

  @Post('teams')
  create(@Body() body: unknown) {
    return this.teams.create(body);
  }

  @Put('teams/:id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.teams.update(id, body);
  }

  @Delete('teams/:id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    this.teams.delete(id);
  }

  @Get('users')
  listUsers() {
    return this.users.list();
  }
}

@Controller('v2')
export class TeamsV2Controller {
  constructor(
    private readonly teams: TeamsService,
    private readonly users: UsersService,
    private readonly access: AccessService,
  ) {}

  @Get('teams')
  list() {
    return this.teams.list();
  }

  @Get('teams/:id')
  get(@Param('id') id: string) {
    return this.teams.get(id);
  }

  @Post('teams')
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: User, @Body() body: unknown) {
    this.access.requireAnyAdmin(user);
    return this.teams.create(body);
  }

  @Put('teams/:id')
  @UseGuards(AuthGuard)
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    this.access.requireTeamAdmin(user, id);
    return this.teams.update(id, body);
  }

  @Delete('teams/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    this.access.requireTeamAdmin(user, id);
    this.teams.delete(id);
  }

  @Get('users')
  @UseGuards(AuthGuard)
  listUsers(@CurrentUser() user: User) {
    this.access.requireAnyAdmin(user);
    return this.users.list();
  }
}
