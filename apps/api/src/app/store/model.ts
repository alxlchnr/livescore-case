export type ScoringMode = 'CUMULATIVE' | 'SETS';
export type CompetitionKind = 'LEAGUE' | 'TOURNAMENT';
export type Role = 'SYSTEM_ADMIN' | 'LEAGUE_ADMIN' | 'SCORER';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED';
export type Side = 'HOME' | 'AWAY';

export const SCORING_MODES: ScoringMode[] = ['CUMULATIVE', 'SETS'];
export const MATCH_STATUSES: MatchStatus[] = ['SCHEDULED', 'LIVE', 'FINISHED'];

export const EVENT_TYPES = [
  'MATCH_STARTED',
  'PERIOD_STARTED',
  'SCORE',
  'PERIOD_ENDED',
  'MATCH_ENDED',
  'PENALTY',
  'NOTE',
  'CORRECTION',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Competition {
  id: string;
  kind: CompetitionKind;
  name: string;
  scoringMode: ScoringMode;
  /** nur Ligen */
  season?: string;
  /** nur Turniere, Format YYYY-MM-DD */
  startDate?: string;
  endDate?: string;
  teamIds: string[];
  adminIds: string[];
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  password: string;
  roles: Role[];
}

export interface Match {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  venue?: string;
  scorerIds: string[];
}

export interface MatchEvent {
  id: string;
  matchId: string;
  seq: number;
  type: EventType;
  team?: Side;
  points?: number;
  revertsEventId?: string;
  text?: string;
  clientEventId?: string;
  createdAt: string;
  createdBy: string;
}

export interface PeriodScore {
  period: number;
  home: number;
  away: number;
  winner: Side | 'DRAW' | null;
}

export interface Score {
  home: number;
  away: number;
  periods: PeriodScore[];
}

export interface MatchState {
  status: MatchStatus;
  currentPeriod: number | null;
  score: Score;
  revertedEventIds: Set<string>;
}
