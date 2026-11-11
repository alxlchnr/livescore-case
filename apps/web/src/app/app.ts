import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <header>
      <h1>Livescore Verwaltung</h1>
      <nav>
        <a routerLink="/leagues" routerLinkActive="active">Ligen</a>
        <a routerLink="/tournaments" routerLinkActive="active">Turniere</a>
      </nav>
    </header>
    <main>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [
    `
      header {
        background: #1d3557;
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 32px;
      }
      h1 {
        font-size: 20px;
        margin: 0;
      }
      nav a {
        color: #a8dadc;
        margin-right: 16px;
        text-decoration: none;
      }
      nav a.active {
        color: white;
        font-weight: bold;
      }
      main {
        padding: 24px;
      }
    `,
  ],
})
export class App {}
