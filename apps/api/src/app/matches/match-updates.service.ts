import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { optionalNonNegativeInteger } from '../common/validation';
import { Match, MatchStatus } from '../store/model';
import { StoreService } from '../store/store.service';
import { MatchesService, MatchUpdate } from './matches.service';

const DEFAULT_WAIT_SECONDS = 20;
const MAX_WAIT_SECONDS = 25;

export interface MatchUpdates {
  updates: MatchUpdate[];
  lastSeq: number;
  status: MatchStatus;
}

/** Long-Poll-Alternative zum SSE-Stream mit demselben Nachrichtenformat. */
@Injectable()
export class MatchUpdatesService {
  constructor(
    private readonly store: StoreService,
    private readonly matches: MatchesService,
  ) {}

  poll(matchId: string, afterSeqParam: unknown, waitParam: unknown, response: Response): Promise<MatchUpdates> {
    const match = this.matches.find(matchId);
    const afterSeq = optionalNonNegativeInteger(afterSeqParam, 'afterSeq') ?? 0;
    const waitSeconds = Math.min(optionalNonNegativeInteger(waitParam, 'wait') ?? DEFAULT_WAIT_SECONDS, MAX_WAIT_SECONDS);

    const pending = this.collect(match, afterSeq);
    if (pending.updates.length > 0 || pending.status === 'FINISHED' || waitSeconds === 0) {
      return Promise.resolve(pending);
    }

    return new Promise<MatchUpdates>((resolve, reject) => {
      let settled = false;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription.unsubscribe();
        response.off('close', onClose);
        settle();
      };
      const onClose = () => finish(() => resolve(pending));

      const subscription = this.store.stream(matchId).subscribe({
        next: () => finish(() => resolve(this.collect(match, afterSeq))),
        complete: () => finish(() => reject(new NotFoundException(`Spiel "${matchId}" wurde nicht gefunden.`))),
      });
      const timer = setTimeout(() => finish(() => resolve(this.collect(match, afterSeq))), waitSeconds * 1000);
      response.on('close', onClose);
    });
  }

  private collect(match: Match, afterSeq: number): MatchUpdates {
    const events = this.store.eventsOf(match.id).filter((event) => event.seq > afterSeq);
    return {
      updates: events.map((event) => this.matches.updateFor(match, event)),
      lastSeq: events.length > 0 ? events[events.length - 1].seq : afterSeq,
      status: this.matches.toView(match).status,
    };
  }
}
