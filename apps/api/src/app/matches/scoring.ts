import { MatchEvent, MatchState, PeriodScore, ScoringMode } from '../store/model';

/**
 * Berechnet Status, laufenden Abschnitt und Spielstand vollständig aus der
 * Ereignisliste eines Spiels (Fold). Korrigierte Ereignisse werden übersprungen.
 */
export function computeState(events: MatchEvent[], scoringMode: ScoringMode): MatchState {
  const revertedEventIds = new Set(
    events.filter((e) => e.type === 'CORRECTION' && e.revertsEventId).map((e) => e.revertsEventId as string),
  );
  let status: MatchState['status'] = 'SCHEDULED';
  let currentPeriod: number | null = null;
  const periods: PeriodScore[] = [];
  const ended = new Set<number>();

  for (const event of events) {
    switch (event.type) {
      case 'MATCH_STARTED':
        status = 'LIVE';
        break;
      case 'PERIOD_STARTED':
        periods.push({ period: periods.length + 1, home: 0, away: 0, winner: null });
        currentPeriod = periods.length;
        break;
      case 'SCORE':
        if (currentPeriod !== null && !revertedEventIds.has(event.id)) {
          const period = periods[currentPeriod - 1];
          const points = event.points ?? 1;
          if (event.team === 'HOME') period.home += points;
          if (event.team === 'AWAY') period.away += points;
        }
        break;
      case 'PERIOD_ENDED':
        if (currentPeriod !== null) {
          ended.add(currentPeriod);
          currentPeriod = null;
        }
        break;
      case 'MATCH_ENDED':
        status = 'FINISHED';
        currentPeriod = null;
        break;
      default:
        break;
    }
  }

  for (const period of periods) {
    if (ended.has(period.period)) {
      period.winner = period.home > period.away ? 'HOME' : period.away > period.home ? 'AWAY' : 'DRAW';
    }
  }

  const score =
    scoringMode === 'SETS'
      ? {
          home: periods.filter((p) => p.winner === 'HOME').length,
          away: periods.filter((p) => p.winner === 'AWAY').length,
          periods,
        }
      : {
          home: periods.reduce((sum, p) => sum + p.home, 0),
          away: periods.reduce((sum, p) => sum + p.away, 0),
          periods,
        };

  return { status, currentPeriod, score, revertedEventIds };
}
