# Amplop

Two-person household envelope budgeting PWA (Indonesian: *amplop* = envelope).

## Stack

- Vite + React 18 + TypeScript + Tailwind
- Supabase (Auth, Postgres, Realtime, Edge Functions)
- Deploy via `gh-pages` / static hosting

## Features

- Envelope budgets (monthly + save-for / sinking funds)
- Freedom panel: cash snapshots, earmarked vs investable surplus
- Trip planner with daily draws + funding gap / cover suggestions
- Quick text expense logging (`45.000rp ambrogio`)
- USD/IDR spot + 30-day average for planning
- Budget year setting (default January)
- Insights coach with freedom / trip context

## Setup

```bash
cp .env.example .env.local
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
