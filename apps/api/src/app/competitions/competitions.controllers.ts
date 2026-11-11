import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Type, UseGuards } from '@nestjs/common';
import { AccessService } from '../auth/access.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { CompetitionKind, User } from '../store/model';
import { CompetitionsService } from './competitions.service';

function v1Controller(kind: CompetitionKind, path: string): Type<unknown> {
  @Controller(`v1/${path}`)
  class CompetitionsV1Controller {
    constructor(private readonly competitions: CompetitionsService) {}

    @Get()
    list() {
      return this.competitions.list(kind);
    }

    @Get(':id')
    get(@Param('id') id: string) {
      return this.competitions.get(kind, id);
    }

    @Post()
    create(@Body() body: unknown) {
      return this.competitions.create(kind, body);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() body: unknown) {
      return this.competitions.update(kind, id, body);
    }

    @Delete(':id')
    @HttpCode(204)
    delete(@Param('id') id: string) {
      this.competitions.delete(kind, id);
    }

    @Put(':id/teams')
    setTeams(@Param('id') id: string, @Body() body: unknown) {
      return this.competitions.setTeams(kind, id, body);
    }

    @Put(':id/admins')
    setAdmins(@Param('id') id: string, @Body() body: unknown) {
      return this.competitions.setAdmins(kind, id, body);
    }
  }
  return CompetitionsV1Controller;
}

function v2Controller(kind: CompetitionKind, path: string): Type<unknown> {
  @Controller(`v2/${path}`)
  class CompetitionsV2Controller {
    constructor(
      private readonly competitions: CompetitionsService,
      private readonly access: AccessService,
    ) {}

    @Get()
    list() {
      return this.competitions.list(kind);
    }

    @Get(':id')
    get(@Param('id') id: string) {
      return this.competitions.get(kind, id);
    }

    @Post()
    @UseGuards(AuthGuard)
    create(@CurrentUser() user: User, @Body() body: unknown) {
      this.access.requireSystemAdmin(user);
      return this.competitions.create(kind, body);
    }

    @Put(':id')
    @UseGuards(AuthGuard)
    update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
      this.access.requireCompetitionAdmin(user, id);
      return this.competitions.update(kind, id, body);
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(AuthGuard)
    delete(@CurrentUser() user: User, @Param('id') id: string) {
      this.access.requireCompetitionAdmin(user, id);
      this.competitions.delete(kind, id);
    }

    @Put(':id/teams')
    @UseGuards(AuthGuard)
    setTeams(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
      this.access.requireCompetitionAdmin(user, id);
      return this.competitions.setTeams(kind, id, body);
    }

    @Put(':id/admins')
    @UseGuards(AuthGuard)
    setAdmins(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
      this.access.requireSystemAdmin(user);
      return this.competitions.setAdmins(kind, id, body);
    }
  }
  return CompetitionsV2Controller;
}

export const competitionControllers = [
  v1Controller('LEAGUE', 'leagues'),
  v1Controller('TOURNAMENT', 'tournaments'),
  v2Controller('LEAGUE', 'leagues'),
  v2Controller('TOURNAMENT', 'tournaments'),
];
