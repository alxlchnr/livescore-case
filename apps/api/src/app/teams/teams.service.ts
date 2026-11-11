import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { asBody, requireString } from '../common/validation';
import { Team } from '../store/model';
import { StoreService } from '../store/store.service';

@Injectable()
export class TeamsService {
  constructor(private readonly store: StoreService) {}

  list(): Team[] {
    return [...this.store.teams.values()].map((t) => ({ ...t }));
  }

  get(id: string): Team {
    return { ...this.find(id) };
  }

  find(id: string): Team {
    const team = this.store.teams.get(id);
    if (!team) throw new NotFoundException(`Team "${id}" wurde nicht gefunden.`);
    return team;
  }

  create(input: unknown): Team {
    const team: Team = { id: this.store.nextId('team'), ...this.parse(input) };
    this.store.teams.set(team.id, team);
    return { ...team };
  }

  update(id: string, input: unknown): Team {
    const team = this.find(id);
    Object.assign(team, this.parse(input));
    return { ...team };
  }

  delete(id: string): void {
    this.find(id);
    const inMatch = [...this.store.matches.values()].some((m) => m.homeTeamId === id || m.awayTeamId === id);
    if (inMatch) {
      throw new ConflictException('Das Team ist in Spielen angesetzt und kann nicht gelöscht werden.');
    }
    for (const competition of this.store.competitions.values()) {
      competition.teamIds = competition.teamIds.filter((teamId) => teamId !== id);
    }
    this.store.teams.delete(id);
  }

  private parse(input: unknown) {
    const body = asBody(input);
    return { name: requireString(body, 'name'), shortName: requireString(body, 'shortName') };
  }
}
