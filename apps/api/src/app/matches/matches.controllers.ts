import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessService } from '../auth/access.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { User } from '../store/model';
import { MatchStreamService } from './match-stream.service';
import { MatchUpdatesService } from './match-updates.service';
import { MatchesService } from './matches.service';

@Controller('v1/matches')
export class MatchesV1Controller {
  constructor(
    private readonly matches: MatchesService,
    private readonly streams: MatchStreamService,
  ) {}

  @Get()
  list(@Query('competitionId') competitionId?: string, @Query('status') status?: string) {
    return this.matches.list({ competitionId, status });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.matches.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.matches.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.matches.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    this.matches.delete(id);
  }

  @Put(':id/scorers')
  setScorers(@Param('id') id: string, @Body() body: unknown) {
    return this.matches.setScorers(id, body);
  }

  @Get(':id/events')
  listEvents(@Param('id') id: string, @Query('afterSeq') afterSeq?: string) {
    return this.matches.listEvents(id, afterSeq);
  }

  @Post(':id/events')
  addEvent(@Param('id') id: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = this.matches.addEvent(id, body, 'anonymous');
    response.status(result.created ? 201 : 200);
    return result.update;
  }

  @Get(':id/stream')
  stream(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    this.streams.open(id, request, response);
  }
}

@Controller('v2/matches')
export class MatchesV2Controller {
  constructor(
    private readonly matches: MatchesService,
    private readonly streams: MatchStreamService,
    private readonly updates: MatchUpdatesService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(@Query('competitionId') competitionId?: string, @Query('status') status?: string) {
    return this.matches.list({ competitionId, status });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.matches.get(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: User, @Body() body: unknown) {
    this.access.requireCompetitionAdminForBody(user, (body as Record<string, unknown> | null)?.['competitionId']);
    return this.matches.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    this.access.requireMatchAdmin(user, id);
    return this.matches.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    this.access.requireMatchAdmin(user, id);
    this.matches.delete(id);
  }

  @Put(':id/scorers')
  @UseGuards(AuthGuard)
  setScorers(@CurrentUser() user: User, @Param('id') id: string, @Body() body: unknown) {
    this.access.requireMatchAdmin(user, id);
    return this.matches.setScorers(id, body);
  }

  @Get(':id/events')
  listEvents(@Param('id') id: string, @Query('afterSeq') afterSeq?: string) {
    return this.matches.listEvents(id, afterSeq);
  }

  @Post(':id/events')
  @UseGuards(AuthGuard)
  addEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.access.requireScorer(user, id);
    const result = this.matches.addEvent(id, body, user.username);
    response.status(result.created ? 201 : 200);
    return result.update;
  }

  @Get(':id/stream')
  stream(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    this.streams.open(id, request, response);
  }

  @Get(':id/updates')
  @Header('Cache-Control', 'no-store')
  pollUpdates(
    @Param('id') id: string,
    @Query('afterSeq') afterSeq: string | undefined,
    @Query('wait') wait: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.updates.poll(id, afterSeq, wait, response);
  }
}
