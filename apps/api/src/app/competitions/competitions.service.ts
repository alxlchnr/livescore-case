import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { asBody, requireDate, requireEnum, requireString, requireStringArray } from '../common/validation';
import { Competition, CompetitionKind, SCORING_MODES } from '../store/model';
import { StoreService } from '../store/store.service';

export type CompetitionView = Omit<Competition, 'kind'>;

const LABEL: Record<CompetitionKind, string> = { LEAGUE: 'Liga', TOURNAMENT: 'Turnier' };

@Injectable()
export class CompetitionsService {
  constructor(private readonly store: StoreService) {}

  list(kind: CompetitionKind): CompetitionView[] {
    return [...this.store.competitions.values()].filter((c) => c.kind === kind).map(toView);
  }

  get(kind: CompetitionKind, id: string): CompetitionView {
    return toView(this.find(kind, id));
  }

  find(kind: CompetitionKind, id: string): Competition {
    const competition = this.store.competitions.get(id);
    if (!competition || competition.kind !== kind) {
      throw new NotFoundException(`${LABEL[kind]} "${id}" wurde nicht gefunden.`);
    }
    return competition;
  }

  create(kind: CompetitionKind, input: unknown): CompetitionView {
    const competition: Competition = {
      id: this.store.nextId(kind === 'LEAGUE' ? 'league' : 'tournament'),
      kind,
      ...this.parse(kind, input),
      teamIds: [],
      adminIds: [],
    };
    this.store.competitions.set(competition.id, competition);
    return toView(competition);
  }

  update(kind: CompetitionKind, id: string, input: unknown): CompetitionView {
    const competition = this.find(kind, id);
    Object.assign(competition, this.parse(kind, input));
    return toView(competition);
  }

  delete(kind: CompetitionKind, id: string): void {
    this.find(kind, id);
    for (const match of [...this.store.matches.values()]) {
      if (match.competitionId === id) this.store.deleteMatch(match.id);
    }
    this.store.competitions.delete(id);
  }

  setTeams(kind: CompetitionKind, id: string, input: unknown): CompetitionView {
    const competition = this.find(kind, id);
    const teamIds = requireStringArray(asBody(input), 'teamIds');
    const unknown = teamIds.filter((teamId) => !this.store.teams.has(teamId));
    if (unknown.length) {
      throw new BadRequestException(`Unbekannte Teams: ${unknown.join(', ')}`);
    }
    competition.teamIds = teamIds;
    return toView(competition);
  }

  setAdmins(kind: CompetitionKind, id: string, input: unknown): CompetitionView {
    const competition = this.find(kind, id);
    const adminIds = requireStringArray(asBody(input), 'adminIds');
    const unknown = adminIds.filter((userId) => !this.store.users.has(userId));
    if (unknown.length) {
      throw new BadRequestException(`Unbekannte Benutzer: ${unknown.join(', ')}`);
    }
    competition.adminIds = adminIds;
    return toView(competition);
  }

  private parse(kind: CompetitionKind, input: unknown) {
    const body = asBody(input);
    const name = requireString(body, 'name');
    const scoringMode = requireEnum(body, 'scoringMode', SCORING_MODES);
    if (kind === 'LEAGUE') {
      return { name, scoringMode, season: requireString(body, 'season') };
    }
    const startDate = requireDate(body, 'startDate');
    const endDate = requireDate(body, 'endDate');
    if (endDate < startDate) {
      throw new BadRequestException('"endDate" darf nicht vor "startDate" liegen.');
    }
    return { name, scoringMode, startDate, endDate };
  }
}

function toView(competition: Competition): CompetitionView {
  const { id, name, season, startDate, endDate, scoringMode, teamIds, adminIds } = competition;
  return competition.kind === 'LEAGUE'
    ? { id, name, season, scoringMode, teamIds: [...teamIds], adminIds: [...adminIds] }
    : { id, name, startDate, endDate, scoringMode, teamIds: [...teamIds], adminIds: [...adminIds] };
}
