import { Injectable, OnModuleInit } from '@nestjs/common';
import { MatchesService } from '../matches/matches.service';
import { Competition, Role, Side } from './model';
import { StoreService } from './store.service';

export const SEED_PASSWORD = 'livescore';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Befüllt den Datenbestand beim Start mit einer Handball-Liga und einem Volleyball-Turnier. */
@Injectable()
export class SeedService implements OnModuleInit {
  private random = mulberry32(20260517);

  constructor(
    private readonly store: StoreService,
    private readonly matches: MatchesService,
  ) {}

  onModuleInit(): void {
    const now = Date.now();
    const today = startOfDay(now);

    this.user('admin', 'Alex Admin', ['SYSTEM_ADMIN']);
    const handballAdmin = this.user('handball-admin', 'Hanna Berger', ['LEAGUE_ADMIN']);
    const volleyballAdmin = this.user('volleyball-admin', 'Volker Lang', ['LEAGUE_ADMIN']);
    const handballScorer = this.user('schreiber-handball', 'Sam Schreiber', ['SCORER']);
    const volleyballScorer = this.user('schreiber-volleyball', 'Vera Netz', ['SCORER']);

    const handballTeams = [
      this.team('HSG Neckartal', 'NEC'),
      this.team('TSV Bergheim', 'BER'),
      this.team('SG Rheinfeld', 'RHF'),
      this.team('HC Lindau', 'LIN'),
      this.team('TuS Waldhausen', 'WAL'),
      this.team('HV Seestadt', 'SEE'),
    ];
    const volleyballTeams = [
      this.team('VC Nordstern', 'NOR'),
      this.team('SV Blau-Weiß Eichenau', 'EIC'),
      this.team('USC Talheim', 'TAL'),
      this.team('Volley Team Brückstadt', 'BRU'),
      this.team('TV Sonnenberg', 'SON'),
      this.team('DJK Am Hang', 'DJK'),
    ];
    this.team('SC Hafenviertel', 'HAF');
    this.team('TSG Mühlbach', 'MUE');

    const year = new Date(now).getFullYear();
    const seasonStart = new Date(now).getMonth() >= 6 ? year : year - 1;
    const league = this.competition({
      kind: 'LEAGUE',
      name: 'Handball-Regionalliga Süd',
      season: `${seasonStart}/${String(seasonStart + 1).slice(2)}`,
      scoringMode: 'CUMULATIVE',
      teamIds: handballTeams,
      adminIds: [handballAdmin],
    });
    const tournament = this.competition({
      kind: 'TOURNAMENT',
      name: 'Volleyball-Stadtturnier',
      startDate: isoDate(today - DAY),
      endDate: isoDate(today + DAY),
      scoringMode: 'SETS',
      teamIds: volleyballTeams,
      adminIds: [volleyballAdmin],
    });

    const [nec, ber, rhf, lin, wal, see] = handballTeams;
    this.finished(league, nec, ber, now - 6 * DAY, 'Sporthalle Neckartal', [[14, 12], [13, 16]], handballScorer, true);
    this.finished(league, rhf, lin, now - 5 * DAY, 'Rheinhalle', [[15, 13], [16, 12]], handballScorer);
    this.live(league, wal, see, now - 45 * 60 * 1000, 'Waldhalle', [[13, 11]], [6, 7], handballScorer);
    this.scheduled(league, ber, rhf, today + 2 * DAY + 19 * HOUR, 'Bergheim-Arena', [handballScorer]);
    this.scheduled(league, lin, wal, today + 3 * DAY + 18 * HOUR, 'Seehalle Lindau', []);
    this.scheduled(league, see, nec, today + 9 * DAY + 17 * HOUR, 'Hafenhalle Seestadt', []);

    const [nor, eic, tal, bru, son, djk] = volleyballTeams;
    this.finished(tournament, nor, eic, today - DAY + 10 * HOUR, 'Halle 1', [[25, 21], [23, 25], [25, 19], [25, 22]], volleyballScorer);
    this.finished(tournament, tal, bru, today - DAY + 12 * HOUR, 'Halle 2', [[25, 18], [25, 20], [25, 23]], volleyballScorer);
    this.live(tournament, son, djk, now - 50 * 60 * 1000, 'Halle 1', [[25, 21], [23, 25]], [12, 9], volleyballScorer);
    this.scheduled(tournament, nor, tal, today + DAY + 10 * HOUR, 'Halle 1', [volleyballScorer]);
    this.scheduled(tournament, eic, son, today + DAY + 11 * HOUR, 'Halle 2', []);
    this.scheduled(tournament, bru, djk, today + DAY + 13 * HOUR, 'Halle 1', []);
  }

  private user(username: string, name: string, roles: Role[]): string {
    const id = this.store.nextId('user');
    this.store.users.set(id, { id, username, name, password: SEED_PASSWORD, roles });
    return id;
  }

  private team(name: string, shortName: string): string {
    const id = this.store.nextId('team');
    this.store.teams.set(id, { id, name, shortName });
    return id;
  }

  private competition(data: Omit<Competition, 'id'>): string {
    const id = this.store.nextId(data.kind === 'LEAGUE' ? 'league' : 'tournament');
    this.store.competitions.set(id, { id, ...data });
    return id;
  }

  private scheduled(competitionId: string, home: string, away: string, at: number, venue: string, scorerIds: string[]) {
    const match = this.matches.create({
      competitionId,
      homeTeamId: home,
      awayTeamId: away,
      scheduledAt: new Date(at).toISOString(),
      venue,
    });
    this.matches.setScorers(match.id, { scorerIds });
    return match.id;
  }

  private finished(
    competitionId: string,
    home: string,
    away: string,
    at: number,
    venue: string,
    periods: [number, number][],
    scorer: string,
    withCorrection = false,
  ) {
    const matchId = this.scheduled(competitionId, home, away, at, venue, [scorer]);
    const by = this.store.users.get(scorer)?.username ?? 'seed';
    this.event(matchId, { type: 'MATCH_STARTED' }, by);
    periods.forEach(([h, a], index) => {
      this.playPeriod(matchId, h, a, by, withCorrection && index === 1);
    });
    this.event(matchId, { type: 'MATCH_ENDED' }, by);
    this.spreadTimestamps(matchId, at, at + (periods.length > 2 ? 100 : 70) * 60 * 1000);
  }

  private live(
    competitionId: string,
    home: string,
    away: string,
    at: number,
    venue: string,
    periods: [number, number][],
    current: [number, number],
    scorer: string,
  ) {
    const matchId = this.scheduled(competitionId, home, away, at, venue, [scorer]);
    const by = this.store.users.get(scorer)?.username ?? 'seed';
    this.event(matchId, { type: 'MATCH_STARTED' }, by);
    for (const [h, a] of periods) this.playPeriod(matchId, h, a, by);
    this.event(matchId, { type: 'PERIOD_STARTED' }, by);
    this.scores(matchId, current[0], current[1], by, false);
    this.spreadTimestamps(matchId, at, Date.now() - 5000);
  }

  private playPeriod(matchId: string, home: number, away: number, by: string, withCorrection = false) {
    this.event(matchId, { type: 'PERIOD_STARTED' }, by);
    this.scores(matchId, home, away, by, true);
    if (withCorrection) {
      const wrong = this.event(matchId, { type: 'SCORE', team: 'AWAY' }, by);
      this.event(matchId, { type: 'NOTE', text: 'Tor nach Videobeweis aberkannt' }, by);
      this.event(matchId, { type: 'CORRECTION', revertsEventId: wrong }, by);
    }
    this.event(matchId, { type: 'PERIOD_ENDED' }, by);
  }

  private scores(matchId: string, home: number, away: number, by: string, winnerLast: boolean) {
    const sides: Side[] = [...Array(home).fill('HOME'), ...Array(away).fill('AWAY')];
    for (let i = sides.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [sides[i], sides[j]] = [sides[j], sides[i]];
    }
    if (winnerLast && home !== away) {
      const winner: Side = home > away ? 'HOME' : 'AWAY';
      const index = sides.lastIndexOf(winner);
      [sides[index], sides[sides.length - 1]] = [sides[sides.length - 1], sides[index]];
    }
    sides.forEach((team, index) => {
      this.event(matchId, { type: 'SCORE', team }, by);
      if (this.scoringModeIsCumulative(matchId) && index % 17 === 9) {
        this.event(matchId, { type: 'PENALTY', team: this.random() < 0.5 ? 'HOME' : 'AWAY', text: '2 Minuten' }, by);
      }
    });
  }

  private scoringModeIsCumulative(matchId: string): boolean {
    return this.matches.scoringModeOf(this.matches.find(matchId)) === 'CUMULATIVE';
  }

  private event(matchId: string, body: Record<string, unknown>, by: string): string {
    return this.matches.addEvent(matchId, body, by).update.event.id;
  }

  private spreadTimestamps(matchId: string, from: number, to: number) {
    const events = this.store.eventsOf(matchId);
    const step = (to - from) / Math.max(events.length - 1, 1);
    events.forEach((event, index) => {
      event.createdAt = new Date(Math.round(from + index * step)).toISOString();
    });
  }
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isoDate(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
