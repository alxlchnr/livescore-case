import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="toolbar">
      <h2>Turniere</h2>
      <button class="primary" (click)="newTournament()">Neues Turnier</button>
    </div>

    <div *ngIf="loading">Lade Turniere...</div>

    <table *ngIf="!loading">
      <thead>
        <tr>
          <th>Name</th>
          <th>Zeitraum</th>
          <th>Wertung</th>
          <th>Teams</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let tournament of tournaments" [class.selected]="selected && selected.id == tournament.id">
          <td>{{ tournament.name }}</td>
          <td>{{ tournament.startDate | date: 'dd.MM.yyyy' }} - {{ tournament.endDate | date: 'dd.MM.yyyy' }}</td>
          <td>{{ tournament.scoringMode == 'CUMULATIVE' ? 'Punkte' : 'Sätze' }}</td>
          <td>
            <span *ngFor="let teamId of tournament.teamIds; let last = last">
              {{ teamName(teamId) }}<span *ngIf="!last">, </span>
            </span>
            <span *ngIf="tournament.teamIds.length == 0" class="muted">keine</span>
          </td>
          <td class="actions">
            <button (click)="edit(tournament)">Bearbeiten</button>
            <button (click)="remove(tournament)">Löschen</button>
          </td>
        </tr>
        <tr *ngIf="tournaments.length == 0">
          <td colspan="5" class="muted">Keine Turniere vorhanden.</td>
        </tr>
      </tbody>
    </table>

    <div class="edit" *ngIf="selected">
      <h3>{{ selected.id ? 'Turnier bearbeiten' : 'Neues Turnier' }}</h3>
      <form #tournamentForm="ngForm" (ngSubmit)="save()">
        <label>
          Name
          <input type="text" name="name" [(ngModel)]="selected.name" />
        </label>
        <label>
          Startdatum
          <input type="date" name="startDate" [(ngModel)]="selected.startDate" />
        </label>
        <label>
          Enddatum
          <input type="date" name="endDate" [(ngModel)]="selected.endDate" />
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
      .edit input[type='date'],
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
export class TournamentsComponent implements OnInit {
  tournaments: any[] = [];
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
    this.http.get('/api/v1/tournaments').subscribe((tournaments: any) => {
      this.http.get('/api/v1/teams').subscribe((teams: any) => {
        this.teams = teams;
        this.tournaments = tournaments;
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

  newTournament() {
    this.selected = { name: '', startDate: '', endDate: '', scoringMode: 'SETS', teamIds: [] };
    this.selectedTeams = {};
  }

  edit(tournament: any) {
    this.http.get('/api/v1/tournaments/' + tournament.id).subscribe((data: any) => {
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
      startDate: this.selected.startDate,
      endDate: this.selected.endDate,
      scoringMode: this.selected.scoringMode,
    };

    if (this.selected.id) {
      this.http.put('/api/v1/tournaments/' + this.selected.id, body).subscribe(
        (tournament: any) => {
          this.http.put('/api/v1/tournaments/' + tournament.id + '/teams', { teamIds: teamIds }).subscribe(
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
      this.http.post('/api/v1/tournaments', body).subscribe(
        (tournament: any) => {
          this.http.put('/api/v1/tournaments/' + tournament.id + '/teams', { teamIds: teamIds }).subscribe(
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

  remove(tournament: any) {
    if (confirm('Turnier "' + tournament.name + '" wirklich löschen? Alle Spiele des Turniers werden ebenfalls gelöscht.')) {
      this.http.delete('/api/v1/tournaments/' + tournament.id).subscribe(
        () => {
          if (this.selected && this.selected.id == tournament.id) {
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
