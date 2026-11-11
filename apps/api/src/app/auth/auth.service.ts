import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { asBody } from '../common/validation';
import { User } from '../store/model';
import { StoreService } from '../store/store.service';
import { UserDetails, UsersService } from '../users/users.service';

export const JWT_SECRET = process.env['JWT_SECRET'] ?? 'livescore-dev-secret';
export const JWT_EXPIRES_IN = '8h';

interface TokenPayload {
  sub: string;
  name: string;
  roles: string[];
  scopes: { competitionIds: string[]; matchIds: string[] };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly store: StoreService,
    private readonly users: UsersService,
  ) {}

  login(input: unknown): { accessToken: string; user: UserDetails } {
    const body = asBody(input);
    const user = typeof body['username'] === 'string' ? this.users.findByUsername(body['username']) : undefined;
    if (!user || user.password !== body['password']) {
      throw new UnauthorizedException('Benutzername oder Passwort ist falsch.');
    }
    const details = this.users.details(user);
    const payload: TokenPayload = {
      sub: user.id,
      name: user.name,
      roles: user.roles,
      scopes: details.permissions,
    };
    return { accessToken: this.jwt.sign(payload), user: details };
  }

  /** Prüft das Bearer-Token und liefert den aktuellen Benutzer aus dem Datenbestand. */
  authenticate(authorization: string | undefined): User {
    const [scheme, token] = (authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer-Token fehlt.');
    }
    let payload: TokenPayload;
    try {
      payload = this.jwt.verify<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token ist ungültig oder abgelaufen.');
    }
    const user = this.store.users.get(payload.sub);
    if (!user) throw new UnauthorizedException('Benutzer existiert nicht mehr.');
    return user;
  }
}
