import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessService } from './auth/access.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService, JWT_EXPIRES_IN, JWT_SECRET } from './auth/auth.service';
import { competitionControllers } from './competitions/competitions.controllers';
import { CompetitionsService } from './competitions/competitions.service';
import { MatchStreamService } from './matches/match-stream.service';
import { MatchUpdatesService } from './matches/match-updates.service';
import { MatchesV1Controller, MatchesV2Controller } from './matches/matches.controllers';
import { MatchesService } from './matches/matches.service';
import { SimulatorService } from './simulator/simulator.service';
import { SeedService } from './store/seed.service';
import { StoreService } from './store/store.service';
import { TeamsV1Controller, TeamsV2Controller } from './teams/teams.controllers';
import { TeamsService } from './teams/teams.service';
import { UsersService } from './users/users.service';

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: JWT_EXPIRES_IN } })],
  controllers: [
    AuthController,
    ...competitionControllers,
    TeamsV1Controller,
    TeamsV2Controller,
    MatchesV1Controller,
    MatchesV2Controller,
  ],
  providers: [
    StoreService,
    SeedService,
    UsersService,
    AuthService,
    AuthGuard,
    AccessService,
    CompetitionsService,
    TeamsService,
    MatchesService,
    MatchStreamService,
    MatchUpdatesService,
    SimulatorService,
  ],
})
export class AppModule {}
