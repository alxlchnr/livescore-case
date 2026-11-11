import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../store/model';
import { StoreService } from '../store/store.service';

/**
 * Ressourcenbezogene Berechtigungsprüfungen für `v2`. Geprüft wird stets gegen
 * den aktuellen Datenbestand, damit geänderte Zuweisungen sofort greifen.
 */
@Injectable()
export class AccessService {
  constructor(private readonly store: StoreService) {}

  isSystemAdmin(user: User): boolean {
    return user.roles.includes('SYSTEM_ADMIN');
  }

  requireSystemAdmin(user: User): void {
    if (!this.isSystemAdmin(user)) {
      throw new ForbiddenException('Nur für SYSTEM_ADMIN erlaubt.');
    }
  }

  requireAnyAdmin(user: User): void {
    if (!this.isSystemAdmin(user) && !user.roles.includes('LEAGUE_ADMIN')) {
      throw new ForbiddenException('Nur für SYSTEM_ADMIN und LEAGUE_ADMIN erlaubt.');
    }
  }

  isCompetitionAdmin(user: User, competitionId: string): boolean {
    if (this.isSystemAdmin(user)) return true;
    const competition = this.store.competitions.get(competitionId);
    return !!competition && user.roles.includes('LEAGUE_ADMIN') && competition.adminIds.includes(user.id);
  }

  /** Für Wettbewerbe aus dem Pfad: unbekannte IDs ergeben 404 im Service. */
  requireCompetitionAdmin(user: User, competitionId: string): void {
    if (!this.store.competitions.has(competitionId)) return;
    if (!this.isCompetitionAdmin(user, competitionId)) {
      throw new ForbiddenException('Keine Berechtigung für diesen Wettbewerb.');
    }
  }

  /** Für Wettbewerbe aus dem Request-Body: unbekannte IDs ergeben 400 im Service. */
  requireCompetitionAdminForBody(user: User, competitionId: unknown): void {
    if (typeof competitionId !== 'string' || !this.store.competitions.has(competitionId)) {
      this.requireAnyAdmin(user);
      return;
    }
    this.requireCompetitionAdmin(user, competitionId);
  }

  requireTeamAdmin(user: User, teamId: string): void {
    if (this.isSystemAdmin(user) || !this.store.teams.has(teamId)) return;
    const allowed = [...this.store.competitions.values()].some(
      (c) => c.teamIds.includes(teamId) && this.isCompetitionAdmin(user, c.id),
    );
    if (!allowed) {
      throw new ForbiddenException('Keine Berechtigung für dieses Team.');
    }
  }

  requireMatchAdmin(user: User, matchId: string): void {
    const match = this.store.matches.get(matchId);
    if (!match) return;
    if (!this.isCompetitionAdmin(user, match.competitionId)) {
      throw new ForbiddenException('Keine Berechtigung für dieses Spiel.');
    }
  }

  requireScorer(user: User, matchId: string): void {
    const match = this.store.matches.get(matchId);
    if (!match) throw new NotFoundException(`Spiel "${matchId}" wurde nicht gefunden.`);
    if (this.isCompetitionAdmin(user, match.competitionId)) return;
    if (!user.roles.includes('SCORER') || !match.scorerIds.includes(user.id)) {
      throw new ForbiddenException('Keine Berechtigung, Ereignisse für dieses Spiel zu erfassen.');
    }
  }
}
