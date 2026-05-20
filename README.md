# Amplop

Two-person household envelope budgeting PWA (Indonesian: *amplop* = envelope).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Auth, Postgres, Realtime, Edge Functions)
- Deploy target: Cloudflare Pages (not Vercel)

## Phase 1 (current)

- Magic-link auth
- Bottom tab navigation
- Empty Envelopes screen
- PWA manifest + service worker stub

## Setup

```bash
cp .env.example .env.local
# Add your Supabase URL and anon key

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Auth

1. Enable Email magic link in Authentication → Providers.
2. Site URL: `http://localhost:3000`
3. Redirect URLs: `http://localhost:3000/auth/callback`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |

## Build phases

See project plan: Phase 2 = schema + envelopes CRUD, then transactions, FX, trips, realtime, insights, voice, offline.
