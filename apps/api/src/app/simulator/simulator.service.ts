import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { MatchesService, MatchView } from '../matches/matches.service';
import { PeriodScore } from '../store/model';
import { StoreService } from '../store/store.service';

const SIMULATOR = 'simulator';
const RESTART_DELAY_MS = 10_000;

/**
 * Lässt die Seed-Spiele im Status LIVE weiterlaufen. Ereignisse entstehen über
 * denselben Service wie bei API-Aufrufen. Abschaltbar mit LIVE_SIMULATOR=false.
 */
@Injectable()
export class SimulatorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('LiveSimulator');
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly periodTargets = new Map<string, number>();

  constructor(
    private readonly store: StoreService,
    private readonly matches: MatchesService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['LIVE_SIMULATOR'] === 'false') {
      this.logger.log('Live-Simulator ist abgeschaltet (LIVE_SIMULATOR=false).');
      return;
    }
    const live = this.matches.list({ status: 'LIVE' });
    live.forEach((match) => this.schedule(match.id));
    this.logger.log(`Live-Simulator aktiv für ${live.length} Spiele.`);
  }

  onApplicationShutdown(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  private schedule(matchId: string, delay = 2000 + Math.random() * 2000): void {
    this.timers.set(
      matchId,
      setTimeout(() => this.tick(matchId), delay),
    );
  }

  private tick(matchId: string): void {
    this.timers.delete(matchId);
    if (!this.store.matches.has(matchId)) return;
    const match = this.matches.get(matchId);

    if (match.status === 'FINISHED') {
      this.timers.set(
        matchId,
        setTimeout(() => {
          this.timers.delete(matchId);
          this.restart(match);
        }, RESTART_DELAY_MS),
      );
      return;
    }
    try {
      this.step(match);
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        this.logger.warn(`Simulation von ${matchId} gestoppt: ${(error as Error).message}`);
        return;
      }
    }
    this.schedule(matchId);
  }

  private step(match: MatchView): void {
    if (match.status === 'SCHEDULED') {
      this.emit(match.id, { type: 'MATCH_STARTED' });
      return;
    }
    if (match.currentPeriod === null) {
      this.emit(match.id, { type: this.isMatchOver(match) ? 'MATCH_ENDED' : 'PERIOD_STARTED' });
      return;
    }
    const period = match.score.periods[match.currentPeriod - 1];
    if (this.isPeriodOver(match, period)) {
      this.periodTargets.delete(match.id);
      this.emit(match.id, { type: 'PERIOD_ENDED' });
      return;
    }
    const lastOwnScore = this.lastOwnScore(match.id);
    if (lastOwnScore && Math.random() < 0.05) {
      this.emit(match.id, { type: 'CORRECTION', revertsEventId: lastOwnScore });
      return;
    }
    this.emit(match.id, { type: 'SCORE', team: Math.random() < 0.5 ? 'HOME' : 'AWAY' });
  }

  private isPeriodOver(match: MatchView, period: PeriodScore): boolean {
    if (match.scoringMode === 'SETS') {
      return Math.max(period.home, period.away) >= 25 && Math.abs(period.home - period.away) >= 2;
    }
    let target = this.periodTargets.get(match.id);
    if (target === undefined) {
      target = Math.max(period.home + period.away + 4, 22 + Math.floor(Math.random() * 11));
      this.periodTargets.set(match.id, target);
    }
    return period.home + period.away >= target;
  }

  private isMatchOver(match: MatchView): boolean {
    if (match.scoringMode === 'SETS') {
      return match.score.home >= 3 || match.score.away >= 3;
    }
    return match.score.periods.length >= 2;
  }

  private lastOwnScore(matchId: string): string | undefined {
    const events = this.store.eventsOf(matchId);
    const reverted = new Set(events.map((e) => e.revertsEventId).filter(Boolean));
    const lastScore = [...events].reverse().find((e) => e.type === 'SCORE' && e.createdBy === SIMULATOR);
    return lastScore && !reverted.has(lastScore.id) ? lastScore.id : undefined;
  }

  private restart(finished: MatchView): void {
    if (!this.store.competitions.has(finished.competitionId)) return;
    try {
      const next = this.matches.create({
        competitionId: finished.competitionId,
        homeTeamId: finished.awayTeam.id,
        awayTeamId: finished.homeTeam.id,
        scheduledAt: new Date().toISOString(),
        venue: finished.venue,
      });
      this.matches.setScorers(next.id, { scorerIds: finished.scorerIds });
      this.schedule(next.id);
    } catch (error) {
      this.logger.warn(`Neues Live-Spiel konnte nicht gestartet werden: ${(error as Error).message}`);
    }
  }

  private emit(matchId: string, body: Record<string, unknown>): void {
    this.matches.addEvent(matchId, body, SIMULATOR);
  }
}
