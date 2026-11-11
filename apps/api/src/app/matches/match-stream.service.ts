import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StoreService } from '../store/store.service';
import { MatchesService } from './matches.service';

const HEARTBEAT_MS = 15_000;

/** Server-Sent-Events-Stream je Spiel mit Wiederaufnahme über `Last-Event-ID`. */
@Injectable()
export class MatchStreamService {
  constructor(
    private readonly store: StoreService,
    private readonly matches: MatchesService,
  ) {}

  open(matchId: string, request: Request, response: Response): void {
    const match = this.matches.find(matchId);
    const lastEventId = parseLastEventId(request.header('last-event-id') ?? request.query['lastEventId']);

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write('retry: 3000\n\n');

    let lastSent = lastEventId;
    const send = (seq: number) => {
      const event = this.store.eventsOf(matchId).find((e) => e.seq === seq);
      if (!event || seq <= lastSent) return;
      lastSent = seq;
      const data = this.matches.updateFor(match, event);
      response.write(`id: ${seq}\nevent: match-event\ndata: ${JSON.stringify(data)}\n\n`);
    };

    for (const event of this.store.eventsOf(matchId)) {
      if (event.seq > lastEventId) send(event.seq);
    }

    const subscription = this.store.stream(matchId).subscribe({
      next: (event) => send(event.seq),
      complete: () => response.end(),
    });
    const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), HEARTBEAT_MS);

    request.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });
  }
}

function parseLastEventId(value: unknown): number {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException('"Last-Event-ID" muss eine nicht-negative ganze Zahl sein.');
  }
  return parsed;
}
