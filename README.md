# English Pronunciation Practice MVP

Pronunciation feedback app for a Vietnamese English learner practicing DevOps/cloud sentences.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth and Postgres
- Cloudflare R2
- Gemini `gemini-2.5-flash`
- Gemini `gemini-2.5-flash`
- Cloudflare Pages with `@cloudflare/next-on-pages`

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Run locally:

```bash
npm run dev
```

## Supabase

1. Create a Supabase project.
2. Enable email auth.
3. Paste `seed/schema.sql` into the SQL editor and run it.
4. Paste `seed/items.sql` into the SQL editor and run it.
5. Copy the project URL and anon key into `.env.local`.

The schema enables RLS. `items` are readable by authenticated users, and every `recordings` policy is restricted with `auth.uid() = user_id`.

## Cloudflare R2

1. Create an R2 bucket.
2. Create R2 API tokens with object read/write access for the bucket.
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.
4. Configure a public/custom domain for reads and set `R2_PUBLIC_URL`.
5. Add CORS rules that allow browser `PUT` uploads from your local and production origins.

Example CORS rule:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run pages:build
npm run secrets:scan
```

## Deploy To Cloudflare Pages

Use this build command:

```bash
npm run pages:build
```

Set the same environment variables in Cloudflare Pages. The generated output is handled by `@cloudflare/next-on-pages`.

## GitHub And Secrets

This repo uses `gitleaks` in two places:

- `npm run secrets:scan` for local checks
- `.github/workflows/gitleaks.yml` for push and pull request checks

The tracked hook at `.githooks/pre-push` runs the same scan before a push. Enable it once per clone with:

```bash
git config core.hooksPath .githooks
```

## Notes

- Audio is recorded as `audio/webm`.
- The browser uploads audio directly to R2 through `/api/upload-url`.
- `/api/transcribe` sends the uploaded file to Gemini.
- `/api/feedback` sends the transcript and target sentence to Gemini, validates the JSON response, then stores the attempt in Supabase.
- Real Supabase, R2, Gemini credentials are required to test the full recording flow.
