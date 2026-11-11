import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  asBody,
  Body,
  optionalNonNegativeInteger,
  optionalString,
  requireDateTime,
  requireEnum,
  requireString,
  requireStringArray,
} from '../common/validation';
import {
  EVENT_TYPES,
  Match,
  MATCH_STATUSES,
  MatchEvent,
  MatchStatus,
  Score,
  ScoringMode,
  Side,
  Team,
} from '../store/model';
import { StoreService } from '../store/store.service';
import { computeState } from './scoring';

export interface MatchView {
  id: string;
  competitionId: string;
  scoringMode: ScoringMode;
  homeTeam: Team;
  awayTeam: Team;
  scheduledAt: string;
  venue?: string;
  scorerIds: string[];
  status: MatchStatus;
  currentPeriod: number | null;
  score: Score;
  lastSeq: number;
}

export interface MatchUpdate {
  event: MatchEvent;
  score: Score;
  status: MatchStatus;
  currentPeriod: number | null;
}

export interface MatchFilter {
  competitionId?: string;
  status?: string;
}

const SIDES: Side[] = ['HOME', 'AWAY'];

@Injectable()
export class MatchesService {
  constructor(private readonly store: StoreService) {}

  list(filter: MatchFilter): MatchView[] {
    if (filter.status && !MATCH_STATUSES.includes(filter.status as MatchStatus)) {
      throw new BadRequestException(`Parameter "status" muss einer der Werte ${MATCH_STATUSES.join(', ')} sein.`);
    }
    return [...this.store.matches.values()]
      .filter((m) => !filter.competitionId || m.competitionId === filter.competitionId)
      .map((m) => this.toView(m))
      .filter((m) => !filter.status || m.status === filter.status)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  get(id: string): MatchView {
    return this.toView(this.find(id));
  }

  find(id: string): Match {
    const match = this.store.matches.get(id);
    if (!match) throw new NotFoundException(`Spiel "${id}" wurde nicht gefunden.`);
    return match;
  }

  create(input: unknown): MatchView {
    const body = asBody(input);
    const competitionId = requireString(body, 'competitionId');
    if (!this.store.competitions.has(competitionId)) {
      throw new BadRequestException(`Wettbewerb "${competitionId}" existiert nicht.`);
    }
    const match: Match = {
      id: this.store.nextId('match'),
      competitionId,
      ...this.parseSchedule(competitionId, body),
      scorerIds: [],
    };
    this.store.matches.set(match.id, match);
    return this.toView(match);
  }

  update(id: string, input: unknown): MatchView {
    const match = this.find(id);
    const schedule = this.parseSchedule(match.competitionId, asBody(input));
    const teamsChanged = schedule.homeTeamId !== match.homeTeamId || schedule.awayTeamId !== match.awayTeamId;
    if (teamsChanged && this.store.eventsOf(id).length > 0) {
      throw new ConflictException('Die Teams eines Spiels mit erfassten Ereignissen können nicht geändert werden.');
    }
    match.homeTeamId = schedule.homeTeamId;
    match.awayTeamId = schedule.awayTeamId;
    match.scheduledAt = schedule.scheduledAt;
    match.venue = schedule.venue;
    return this.toView(match);
  }

  delete(id: string): void {
    this.find(id);
    this.store.deleteMatch(id);
  }

  setScorers(id: string, input: unknown): MatchView {
    const match = this.find(id);
    const scorerIds = requireStringArray(asBody(input), 'scorerIds');
    const unknown = scorerIds.filter((userId) => !this.store.users.has(userId));
    if (unknown.length) {
      throw new BadRequestException(`Unbekannte Benutzer: ${unknown.join(', ')}`);
    }
    match.scorerIds = scorerIds;
    return this.toView(match);
  }

  listEvents(id: string, afterSeq?: string): MatchEvent[] {
    this.find(id);
    const after = optionalNonNegativeInteger(afterSeq, 'afterSeq') ?? 0;
    return this.store.eventsOf(id).filter((e) => e.seq > after);
  }

  /**
   * Erfasst ein Ereignis. Liefert `created: false`, wenn ein Ereignis mit derselben
   * `clientEventId` bereits gespeichert war.
   */
  addEvent(matchId: string, input: unknown, createdBy: string): { created: boolean; update: MatchUpdate } {
    const match = this.find(matchId);
    const body = asBody(input);
    const clientEventId = optionalString(body, 'clientEventId');
    const knownIds = this.clientIdsOf(matchId);
    if (clientEventId && knownIds.has(clientEventId)) {
      return { created: false, update: this.updateFor(match, knownIds.get(clientEventId) as MatchEvent) };
    }

    const scoringMode = this.scoringModeOf(match);
    const events = this.store.eventsOf(matchId);
    const draft = this.parseEvent(body, scoringMode);
    this.checkState(draft, events, scoringMode);

    const seq = events.length + 1;
    const event: MatchEvent = {
      id: `${matchId}-e${seq}`,
      matchId,
      seq,
      ...draft,
      ...(clientEventId ? { clientEventId } : {}),
      createdAt: new Date().toISOString(),
      createdBy,
    };
    events.push(event);
    if (clientEventId) knownIds.set(clientEventId, event);
    this.store.stream(matchId).next(event);
    return { created: true, update: this.updateFor(match, event) };
  }

  updateFor(match: Match, event: MatchEvent): MatchUpdate {
    const state = computeState(this.store.eventsOf(match.id).filter((e) => e.seq <= event.seq), this.scoringModeOf(match));
    return { event, score: state.score, status: state.status, currentPeriod: state.currentPeriod };
  }

  toView(match: Match): MatchView {
    const events = this.store.eventsOf(match.id);
    const scoringMode = this.scoringModeOf(match);
    const state = computeState(events, scoringMode);
    return {
      id: match.id,
      competitionId: match.competitionId,
      scoringMode,
      homeTeam: { ...(this.store.teams.get(match.homeTeamId) as Team) },
      awayTeam: { ...(this.store.teams.get(match.awayTeamId) as Team) },
      scheduledAt: match.scheduledAt,
      ...(match.venue ? { venue: match.venue } : {}),
      scorerIds: [...match.scorerIds],
      status: state.status,
      currentPeriod: state.currentPeriod,
      score: state.score,
      lastSeq: events.length,
    };
  }

  scoringModeOf(match: Match): ScoringMode {
    return this.store.competitions.get(match.competitionId)?.scoringMode ?? 'CUMULATIVE';
  }

  private clientIdsOf(matchId: string): Map<string, MatchEvent> {
    let map = this.store.clientEventIds.get(matchId);
    if (!map) {
      map = new Map();
      this.store.clientEventIds.set(matchId, map);
    }
    return map;
  }

  private parseSchedule(competitionId: string, body: Body) {
    const competition = this.store.competitions.get(competitionId);
    const homeTeamId = requireString(body, 'homeTeamId');
    const awayTeamId = requireString(body, 'awayTeamId');
    const scheduledAt = requireDateTime(body, 'scheduledAt');
    const venue = optionalString(body, 'venue');
    if (homeTeamId === awayTeamId) {
      throw new BadRequestException('Heim- und Gastteam müssen verschieden sein.');
    }
    for (const teamId of [homeTeamId, awayTeamId]) {
      if (!competition?.teamIds.includes(teamId)) {
        throw new BadRequestException(`Team "${teamId}" ist dem Wettbewerb nicht zugeordnet.`);
      }
    }
    return { homeTeamId, awayTeamId, scheduledAt, venue };
  }

  private parseEvent(body: Body, scoringMode: ScoringMode) {
    const type = requireEnum(body, 'type', EVENT_TYPES);
    const text = optionalString(body, 'text');
    const draft: Pick<MatchEvent, 'type' | 'team' | 'points' | 'revertsEventId' | 'text'> = { type };
    if (type === 'SCORE' || type === 'PENALTY') {
      draft.team = requireEnum(body, 'team', SIDES);
    }
    if (type === 'SCORE') {
      draft.points = scoringMode === 'SETS' ? 1 : this.parsePoints(body['points']);
    }
    if (type === 'CORRECTION') {
      draft.revertsEventId = requireString(body, 'revertsEventId');
    }
    if (type === 'NOTE' && !text) {
      throw new BadRequestException('Feld "text" ist für NOTE erforderlich.');
    }
    if (text) draft.text = text;
    return draft;
  }

  private parsePoints(value: unknown): number {
    if (value === undefined || value === null) return 1;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('Feld "points" muss eine positive ganze Zahl sein.');
    }
    return value;
  }

  private checkState(draft: Pick<MatchEvent, 'type' | 'revertsEventId'>, events: MatchEvent[], scoringMode: ScoringMode) {
    const state = computeState(events, scoringMode);
    const conflict = (message: string) => {
      throw new ConflictException(message);
    };

    if (draft.type === 'NOTE') return;
    if (draft.type === 'CORRECTION') {
      const target = events.find((e) => e.id === draft.revertsEventId);
      if (!target) conflict(`Ereignis "${draft.revertsEventId}" existiert in diesem Spiel nicht.`);
      else if (target.type !== 'SCORE' && target.type !== 'PENALTY')
        conflict('Nur SCORE- und PENALTY-Ereignisse können korrigiert werden.');
      else if (state.revertedEventIds.has(target.id)) conflict(`Ereignis "${target.id}" wurde bereits korrigiert.`);
      return;
    }
    if (state.status === 'FINISHED') conflict('Das Spiel ist beendet; nur NOTE und CORRECTION sind möglich.');
    if (draft.type === 'MATCH_STARTED') {
      if (state.status !== 'SCHEDULED') conflict('Das Spiel wurde bereits gestartet.');
      return;
    }
    if (state.status !== 'LIVE') conflict('Das Spiel wurde noch nicht gestartet.');
    switch (draft.type) {
      case 'PERIOD_STARTED':
        if (state.currentPeriod !== null) conflict(`Abschnitt ${state.currentPeriod} läuft noch.`);
        break;
      case 'SCORE':
      case 'PERIOD_ENDED':
        if (state.currentPeriod === null) conflict('Es läuft kein Abschnitt.');
        break;
      case 'MATCH_ENDED':
        if (state.currentPeriod !== null) conflict(`Abschnitt ${state.currentPeriod} muss zuerst beendet werden.`);
        break;
      default:
        break;
    }
  }
}
