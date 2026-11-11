import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Competition, Match, MatchEvent, Team, User } from './model';

/**
 * Zentraler In-Memory-Datenbestand. Wird beim Start aus dem Seed befüllt und
 * bei jedem Neustart zurückgesetzt.
 */
@Injectable()
export class StoreService {
  readonly competitions = new Map<string, Competition>();
  readonly teams = new Map<string, Team>();
  readonly users = new Map<string, User>();
  readonly matches = new Map<string, Match>();
  readonly events = new Map<string, MatchEvent[]>();
  readonly clientEventIds = new Map<string, Map<string, MatchEvent>>();

  private readonly streams = new Map<string, Subject<MatchEvent>>();
  private readonly counters = new Map<string, number>();

  nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}-${next}`;
  }

  eventsOf(matchId: string): MatchEvent[] {
    let list = this.events.get(matchId);
    if (!list) {
      list = [];
      this.events.set(matchId, list);
    }
    return list;
  }

  stream(matchId: string): Subject<MatchEvent> {
    let subject = this.streams.get(matchId);
    if (!subject) {
      subject = new Subject<MatchEvent>();
      this.streams.set(matchId, subject);
    }
    return subject;
  }

  deleteMatch(matchId: string): void {
    this.matches.delete(matchId);
    this.events.delete(matchId);
    this.clientEventIds.delete(matchId);
    this.streams.get(matchId)?.complete();
    this.streams.delete(matchId);
  }
}
