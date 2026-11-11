import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-leagues',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="toolbar">
      <h2>Ligen</h2>
      <button class="primary" (click)="newLeague()">Neue Liga</button>
    </div>

    <div *ngIf="loading">Lade Ligen...</div>

    <table *ngIf="!loading">
      <thead>
        <tr>
          <th>Name</th>
          <th>Saison</th>
          <th>Wertung</th>
          <th>Teams</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let league of leagues" [class.selected]="selected && selected.id == league.id">
          <td>{{ league.name }}</td>
          <td>{{ league.season }}</td>
          <td>{{ league.scoringMode == 'CUMULATIVE' ? 'Punkte' : 'Sätze' }}</td>
          <td>
            <span *ngFor="let teamId of league.teamIds; let last = last">
              {{ teamName(teamId) }}<span *ngIf="!last">, </span>
            </span>
            <span *ngIf="league.teamIds.length == 0" class="muted">keine</span>
          </td>
          <td class="actions">
            <button (click)="edit(league)">Bearbeiten</button>
            <button (click)="remove(league)">Löschen</button>
          </td>
        </tr>
        <tr *ngIf="leagues.length == 0">
          <td colspan="5" class="muted">Keine Ligen vorhanden.</td>
        </tr>
      </tbody>
    </table>

    <div class="edit" *ngIf="selected">
      <h3>{{ selected.id ? 'Liga bearbeiten' : 'Neue Liga' }}</h3>
      <form #leagueForm="ngForm" (ngSubmit)="save()">
        <label>
          Name
          <input type="text" name="name" [(ngModel)]="selected.name" />
        </label>
        <label>
          Saison
          <input type="text" name="season" [(ngModel)]="selected.season" placeholder="z. B. 2026/27" />
        </label>
        <label>
          Wertungsmodus
          <select name="scoringMode" [(ngModel)]="selected.scoringMode">
            <option value="CUMULATIVE">Punkte (kumulativ)</option>
            <option value="SETS">Sätze</option>
          </select>
        </label>
        <fieldset>
          <legend>Teams</legend>
          <label class="team" *ngFor="let team of teams">
            <input type="checkbox" name="team_{{ team.id }}" [(ngModel)]="selectedTeams[team.id]" />
            {{ team.name }} ({{ team.shortName }})
          </label>
        </fieldset>
        <div class="buttons">
          <button type="submit" class="primary">Speichern</button>
          <button type="button" (click)="cancel()">Abbrechen</button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th,
      td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #ddd;
        vertical-align: top;
      }
      th {
        background: #f1f1f1;
      }
      tr.selected {
        background: #fff8dc;
      }
      .actions {
        white-space: nowrap;
        text-align: right;
      }
      .muted {
        color: #888;
      }
      button {
        padding: 6px 12px;
        margin-left: 4px;
        cursor: pointer;
      }
      button.primary {
        background: #1d3557;
        color: white;
        border: none;
      }
      .edit {
        margin-top: 24px;
        padding: 16px;
        border: 1px solid #ccc;
        background: #fafafa;
        max-width: 600px;
      }
      .edit label {
        display: block;
        margin-bottom: 12px;
      }
      .edit input[type='text'],
      .edit select {
        display: block;
        width: 100%;
        padding: 6px;
        margin-top: 4px;
        box-sizing: border-box;
      }
      fieldset {
        margin-bottom: 12px;
      }
      .edit label.team {
        display: inline-block;
        width: 48%;
        margin-bottom: 6px;
      }
      .buttons button:first-child {
        margin-left: 0;
      }
    `,
  ],
})
export class LeaguesComponent implements OnInit {
  leagues: any[] = [];
  teams: any[] = [];
  selected: any = null;
  selectedTeams: any = {};
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.http.get('/api/v1/leagues').subscribe((leagues: any) => {
      this.http.get('/api/v1/teams').subscribe((teams: any) => {
        this.teams = teams;
        this.leagues = leagues;
        this.loading = false;
      });
    });
  }

  teamName(id: any) {
    for (let i = 0; i < this.teams.length; i++) {
      if (this.teams[i].id == id) {
        return this.teams[i].name;
      }
    }
    return id;
  }

  newLeague() {
    this.selected = { name: '', season: '', scoringMode: 'CUMULATIVE', teamIds: [] };
    this.selectedTeams = {};
  }

  edit(league: any) {
    this.http.get('/api/v1/leagues/' + league.id).subscribe((data: any) => {
      this.selected = data;
      this.selectedTeams = {};
      for (let i = 0; i < data.teamIds.length; i++) {
        this.selectedTeams[data.teamIds[i]] = true;
      }
    });
  }

  cancel() {
    this.selected = null;
    this.selectedTeams = {};
  }

  save() {
    const teamIds: any[] = [];
    for (const id in this.selectedTeams) {
      if (this.selectedTeams[id]) {
        teamIds.push(id);
      }
    }
    const body: any = {
      name: this.selected.name,
      season: this.selected.season,
      scoringMode: this.selected.scoringMode,
    };

    if (this.selected.id) {
      this.http.put('/api/v1/leagues/' + this.selected.id, body).subscribe(
        (league: any) => {
          this.http.put('/api/v1/leagues/' + league.id + '/teams', { teamIds: teamIds }).subscribe(
            () => {
              this.selected = null;
              this.load();
            },
            (error: any) => {
              alert('Fehler beim Speichern der Teams: ' + error.error.message);
            },
          );
        },
        (error: any) => {
          alert('Fehler beim Speichern: ' + error.error.message);
        },
      );
    } else {
      this.http.post('/api/v1/leagues', body).subscribe(
        (league: any) => {
          this.http.put('/api/v1/leagues/' + league.id + '/teams', { teamIds: teamIds }).subscribe(
            () => {
              this.selected = null;
              this.load();
            },
            (error: any) => {
              alert('Fehler beim Speichern der Teams: ' + error.error.message);
            },
          );
        },
        (error: any) => {
          alert('Fehler beim Anlegen: ' + error.error.message);
        },
      );
    }
  }

  remove(league: any) {
    if (confirm('Liga "' + league.name + '" wirklich löschen? Alle Spiele der Liga werden ebenfalls gelöscht.')) {
      this.http.delete('/api/v1/leagues/' + league.id).subscribe(
        () => {
          if (this.selected && this.selected.id == league.id) {
            this.selected = null;
          }
          this.load();
        },
        (error: any) => {
          alert('Fehler beim Löschen: ' + error.error.message);
        },
      );
    }
  }
}
