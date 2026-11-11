# AGENTS.md

## Stack

- Nx-Monorepo mit npm, Node.js 24 (`.nvmrc`)
- `apps/api`: NestJS 11, TypeScript
- `apps/web`: Angular 22, TypeScript

## Installation

```bash
npm install
```

## Befehle

- `npm start` – startet API und Frontend gemeinsam
- `npm test` – führt die Tests aus

## Ports

- Frontend: http://localhost:4200
- API: http://localhost:3000/api
- Swagger UI: http://localhost:3000/api/docs

## Benutzer

Passwort für alle Benutzer: `livescore`

| Benutzer | Rolle |
|---|---|
| `admin` | `SYSTEM_ADMIN` |
| `handball-admin` | `LEAGUE_ADMIN` (Handball-Regionalliga Süd) |
| `volleyball-admin` | `LEAGUE_ADMIN` (Volleyball-Stadtturnier) |
| `schreiber-handball` | `SCORER` |
| `schreiber-volleyball` | `SCORER` |
