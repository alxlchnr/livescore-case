import { Route } from '@angular/router';
import { LeaguesComponent } from './leagues/leagues.component';
import { TournamentsComponent } from './tournaments/tournaments.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'leagues', pathMatch: 'full' },
  { path: 'leagues', component: LeaguesComponent },
  { path: 'tournaments', component: TournamentsComponent },
  { path: '**', redirectTo: 'leagues' },
];
