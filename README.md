# JobLedger

Receipt scanning, job costing, and expense tracking for contractors — with
an accountant role your bookkeeper can be invited into directly.

## Stack

- [TanStack Start](https://tanstack.com/start) (React, file-based routing, SSR)
- [Supabase](https://supabase.com) (Postgres, Auth, Storage, Row Level Security)
- OpenAI (`gpt-4o-mini`) for receipt OCR/extraction
- Tailwind CSS + shadcn/ui
- Deploys to Vercel by default (Cloudflare Workers also supported)

## Development

```sh
git clone <this-repository-url>
cd your-idea-creator
npm install
cp .env.example .env.local   # fill in your Supabase project + OpenAI key
npm run dev
```

## Database setup

Schema lives as plain SQL in `supabase/migrations/`, filename-ordered.

```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or run each file in order via the Supabase SQL Editor.

## Deployment

```sh
npm run build
npx vercel deploy --prebuilt
```

For Cloudflare Workers instead:
```sh
NITRO_PRESET=cloudflare-module npm run build
npx nitro deploy --prebuilt
```

Required environment variables (see `.env.example`): Supabase URL +
publishable key (client and server), `SUPABASE_SERVICE_ROLE_KEY`, and
`OPENAI_API_KEY` for receipt scanning. Google sign-in additionally requires
the Google provider enabled in Supabase (Authentication → Providers →
Google) with your own Google Cloud OAuth client.

## Accountant access

A business owner invites their accountant by email from Settings → Team.
The accountant needs their own account with that same email — access
activates automatically the moment they sign in, no separate accept step.
Accountants can view every receipt, project, and report, and can correct
receipt categorization, but can't create/edit projects, delete receipts, or
change business settings.
