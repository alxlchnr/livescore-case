# Livescore

Livescore ist eine kleine Anwendung für das Live-Verfolgen und Erfassen von Spielständen im Amateur- und Vereinssport. Sie besteht aus einer REST-API mit Echtzeit-Stream und einem Web-Frontend, in dem bisher die Pflege von Ligen und Turnieren umgesetzt ist.

## Die Domäne

Am Wochenende finden in Hallen und auf Plätzen zahlreiche Spiele parallel statt. Wer nicht vor Ort ist, möchte trotzdem wissen, wie es steht, und wer vor Ort ist, soll den Spielstand mit möglichst wenig Aufwand festhalten können.

### Wer nutzt das System?

**Zuschauer** – Eltern, Fans, Mitspieler, Vereinsmitglieder

- verfolgen ein oder mehrere laufende Spiele, meist auf dem Smartphone, oft unterwegs und mit wechselnder Netzqualität
- wollen ohne Anmeldung sofort den aktuellen Stand sehen, bei Satzsportarten auch den Stand im laufenden Satz
- schauen sich Ergebnisse und den Spielplan eines Wettbewerbs an

**Schreiber / Schiedsrichter** – erfassen die Ereignisse eines Spiels am Spielfeldrand

- bedienen ein Tablet oder Smartphone mit einer Hand, unter Zeitdruck und mitten im Spielgeschehen
- haben in Hallen häufig schlechten oder gar keinen Empfang
- müssen Fehleingaben schnell korrigieren können
- dürfen nur Spiele erfassen, denen sie zugewiesen sind

**Ligaverantwortliche** – organisieren einen Wettbewerb

- legen Ligen bzw. Turniere an, ordnen Teams zu und erstellen den Spielplan
- weisen Spielen Schreiber zu
- arbeiten überwiegend am Desktop, typischerweise vor und nach dem Spieltag

Zusätzlich gibt es Systemadministratoren, die alle Wettbewerbe verwalten und Ligaverantwortliche zuweisen.

### Fachbegriffe

| Begriff | Bedeutung |
|---|---|
| **Wettbewerb** | Oberbegriff für Liga und Turnier. Jeder Wettbewerb hat einen Wertungsmodus. |
| **Liga** | Wettbewerb über eine Saison (z. B. `2026/27`). |
| **Turnier** | Wettbewerb über einen kurzen Zeitraum mit Start- und Enddatum. |
| **Team** | Mannschaft mit Name und Kurzname (z. B. „HSG Neckartal“, `NEC`). Ein Team kann mehreren Wettbewerben angehören. |
| **Spiel** | Begegnung zweier Teams eines Wettbewerbs mit Anstoßzeit und Spielort. Status: `SCHEDULED` (angesetzt), `LIVE` (läuft), `FINISHED` (beendet). |
| **Abschnitt** | Teil eines Spiels – je nach Sportart Halbzeit, Viertel oder Satz. |
| **Spielereignis** | Etwas, das im Spiel passiert: Spielbeginn, Abschnittsbeginn, Punkt/Tor, Abschnittsende, Spielende, Strafe, Notiz oder Korrektur. Jedes Ereignis erhält pro Spiel eine fortlaufende Nummer (`seq`). |
| **Spielstand** | Wird vollständig aus den Ereignissen berechnet – als Gesamtstand und je Abschnitt. Ereignisse werden nie gelöscht; Fehler werden durch ein Korrekturereignis neutralisiert. |

### Wertungsmodi

Das System ist sportartunabhängig. Es kennt zwei Arten, aus den Punkten eines Spiels den Gesamtstand zu bilden:

**Kumulative Wertung (`CUMULATIVE`)** – z. B. Handball, Fußball, Basketball

Der Gesamtstand ist die Summe aller Punkte bzw. Tore über alle Abschnitte.

| | Heim | Gast |
|---|---|---|
| 1. Halbzeit | 14 | 12 |
| 2. Halbzeit | 13 | 16 |
| **Gesamt** | **27** | **28** |

**Satzwertung (`SETS`)** – z. B. Volleyball, Tischtennis, Badminton

Der Gesamtstand ist die Anzahl gewonnener Sätze. Die Punkte innerhalb eines Satzes entscheiden nur, wer den Satz gewinnt. Für Zuschauer ist deshalb neben dem Satzstand vor allem der Stand im laufenden Satz interessant.

| | Heim | Gast | Gewinner |
|---|---|---|---|
| 1. Satz | 25 | 21 | Heim |
| 2. Satz | 23 | 25 | Gast |
| 3. Satz (läuft) | 12 | 9 | – |
| **Gesamt (Sätze)** | **1** | **1** | |

Sportartspezifische Regeln wie Satzlänge, Mindestvorsprung oder Anzahl der Abschnitte prüft das System nicht; das Ende eines Abschnitts und des Spiels wird vom Schreiber erfasst.

## Aufbau

```
apps/
  api/   NestJS-Backend (Port 3000), Daten im Speicher, OpenAPI-Spezifikation in apps/api/openapi.yaml
  web/   Angular-Frontend (Port 4200), Pflege von Ligen und Turnieren
```

Der Workspace ist ein [Nx](https://nx.dev)-Monorepo mit npm.

### API-Versionen

Die API liegt in zwei Versionen vor, die auf demselben Datenbestand arbeiten:

- **`/api/v1`** – veraltet, ohne Authentifizierung
- **`/api/v2`** – aktuell; Lesen und Live-Streams ohne Anmeldung, Schreiben nur mit Token und passender Rolle

Echtzeit-Aktualisierungen eines Spiels liefert die API als Server-Sent Events unter `/api/v2/matches/{id}/stream`. Für Umgebungen, in denen Streams unterwegs gepuffert werden, gibt es dieselben Nachrichten auch per Long-Poll unter `/api/v2/matches/{id}/updates`. Alle Endpunkte sind in der Swagger UI beschrieben und dort direkt ausprobierbar.

### Live-Simulator

Damit es immer etwas zu sehen gibt, lässt ein Simulator die laufenden Spiele aus den Startdaten (ein Handballspiel und ein Volleyballspiel) automatisch weiterlaufen: Alle paar Sekunden fallen Punkte, gelegentlich endet ein Abschnitt oder ein Punkt wird korrigiert. Ist ein Spiel beendet, beginnt kurz darauf ein neues. Ereignisse des Simulators haben `createdBy: "simulator"`.

Spielstände ändern sich deshalb auch ohne eigenes Zutun. Abschalten lässt sich der Simulator so:

```bash
LIVE_SIMULATOR=false npm start
```

### Datenbestand

Alle Daten liegen nur im Speicher. Bei jedem Neustart der API – auch beim automatischen Neustart nach einer Änderung am Backend-Code – wird der Datenbestand auf die Startdaten zurückgesetzt: eine Handball-Liga und ein Volleyball-Turnier mit Teams sowie angesetzten, laufenden und beendeten Spielen.

## Installation und Start

Voraussetzung: Node.js 24 LTS (siehe `.nvmrc`; alternativ Node.js ab 22.22) und npm.

```bash
npm install
npm start
```

`npm start` startet API und Frontend gemeinsam. Änderungen am Frontend werden sofort im Browser aktualisiert, Änderungen an der API führen zu einem automatischen Neustart der API.

### Alternativ: GitHub Codespaces

Der Workspace enthält eine Dev-Container-Konfiguration (`.devcontainer/devcontainer.json`). In GitHub Codespaces (oder lokal mit „Dev Containers: Reopen in Container“) wird `npm install` beim Erstellen automatisch ausgeführt; danach genügt `npm start`. Die Ports 4200 und 3000 werden weitergeleitet, das Frontend öffnet sich im Browser.

Browserbasierte Umgebungen wie StackBlitz werden nicht unterstützt.

| Was | URL |
|---|---|
| Frontend | http://localhost:4200 |
| API | http://localhost:3000/api |
| Swagger UI | http://localhost:3000/api/docs |
| OpenAPI-Spezifikation | http://localhost:3000/api/openapi.yaml |

Das Frontend leitet Aufrufe unter `/api` an die API weiter, sodass die API auch unter http://localhost:4200/api erreichbar ist.

## Benutzer

Passwort für alle Benutzer: `livescore`

| Benutzer | Rolle | Zuständig für |
|---|---|---|
| `admin` | Systemadministrator (`SYSTEM_ADMIN`) | alles |
| `handball-admin` | Ligaverantwortliche (`LEAGUE_ADMIN`) | Handball-Regionalliga Süd |
| `volleyball-admin` | Ligaverantwortlicher (`LEAGUE_ADMIN`) | Volleyball-Stadtturnier |
| `schreiber-handball` | Schreiber (`SCORER`) | Handballspiele, denen er zugewiesen ist |
| `schreiber-volleyball` | Schreiberin (`SCORER`) | Volleyballspiele, denen sie zugewiesen ist |

Anmelden in der Swagger UI:

1. `POST /api/v2/auth/login` mit Benutzername und Passwort ausführen
2. `accessToken` aus der Antwort kopieren
3. Über **Authorize** eintragen

Oder per curl:

```bash
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"livescore"}'
```
