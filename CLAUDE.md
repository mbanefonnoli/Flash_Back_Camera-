# Flashback — Disposable Camera Event App

Next.js 14 App Router + TypeScript + Tailwind + Supabase.

## Architecture rule (CRITICAL)

**The frontend NEVER touches Supabase directly.**

```
Browser → /app/api/** → Supabase (server-side only)
```

- API routes import from `@/lib/supabase-server` (service role key, never exposed to client)
- The only Supabase client the browser ever sees is the anon key in `NEXT_PUBLIC_*` env vars,
  used exclusively by `@/lib/supabase-public` to construct storage URLs — never for DB queries
- All API routes return `{ success: boolean, data?: any, error?: string }`

## Stack

- **Framework**: Next.js 14 App Router
- **Styling**: Tailwind CSS (dark `#0A0A0A` bg, amber `#F5A623` accent)
- **Database**: Supabase Postgres (`events`, `photos`, `reviews` tables)
- **Storage**: Supabase Storage (`photos` bucket — must be **public**)
- **Auth**: None — host password only, guest name in localStorage

## Env vars required

Copy `.env.local.example` → `.env.local` and fill in:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public (URL construction) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase-public.ts` (URL construction only) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-server.ts` (server-side only, never in browser) |

## Database setup (run in Supabase SQL Editor)

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  host_password text not null,
  developed boolean default false,
  created_at timestamptz default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_code text references events(code),
  guest_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz default now()
);
```

Also create a `photos` storage bucket set to **public** in Supabase Storage.
Disable RLS on all tables (or make policies permissive for anon role).

## API routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/events/create` | Create event → `{ code }` |
| GET | `/api/events/[code]` | Get event `{ name, developed }` |
| POST | `/api/events/[code]/develop` | Verify password, set developed=true |
| GET | `/api/events/[code]/photos` | Photos (real URLs only after developed) |
| GET | `/api/events/[code]/stats` | `{ photoCount, guestCount, developed, guestShots? }` |
| POST | `/api/photos/upload` | Multipart upload (image, eventCode, guestName) |
| GET | `/api/reviews` | List reviews, newest first |
| POST | `/api/reviews` | Submit a review `{ name, rating, body }`, shown immediately |

## Page map

| Route | Description |
|---|---|
| `/` | Landing page |
| `/create` | Host: create event |
| `/pricing` | Guest-count based one-time-payment plans |
| `/reviews` | Public reviews — list + submission form |
| `/host/[code]` | Host dashboard (placeholder grid, QR, develop button) |
| `/host/[code]/gallery` | Host: post-develop full gallery |
| `/join/[code]` | Guest: enter name |
| `/camera/[code]` | Guest: viewfinder + shutter |
| `/gallery/[code]` | Guest: waiting room → reveal gallery |

## Dev

```bash
npm run dev     # start dev server (localhost:3000)
npm run build   # production build
npx tsc --noEmit  # type check
npm run lint    # lint
```
