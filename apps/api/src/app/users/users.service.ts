import { Injectable } from '@nestjs/common';
import { Role, User } from '../store/model';
import { StoreService } from '../store/store.service';

export interface UserSummary {
  id: string;
  username: string;
  name: string;
  roles: Role[];
}

export interface UserDetails extends UserSummary {
  permissions: { competitionIds: string[]; matchIds: string[] };
}

@Injectable()
export class UsersService {
  constructor(private readonly store: StoreService) {}

  list(): UserSummary[] {
    return [...this.store.users.values()].map(toSummary);
  }

  findByUsername(username: string): User | undefined {
    return [...this.store.users.values()].find((u) => u.username === username);
  }

  /** Berechtigungen werden stets aus dem aktuellen Datenbestand abgeleitet. */
  details(user: User): UserDetails {
    const competitionIds = [...this.store.competitions.values()]
      .filter((c) => c.adminIds.includes(user.id))
      .map((c) => c.id);
    const matchIds = [...this.store.matches.values()].filter((m) => m.scorerIds.includes(user.id)).map((m) => m.id);
    return { ...toSummary(user), permissions: { competitionIds, matchIds } };
  }
}

function toSummary(user: User): UserSummary {
  return { id: user.id, username: user.username, name: user.name, roles: [...user.roles] };
}
