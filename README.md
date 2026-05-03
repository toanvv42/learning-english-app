# English Pronunciation Practice MVP

Pronunciation feedback app for a Vietnamese English learner practicing topic-based English sentences.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth and Postgres
- Multiple Gemini models (`gemini-2.5-flash`, `gemini-2.5-flash-lite`) for transcription and feedback
- Optional external pronunciation assessment API for phoneme-level evidence
- Optional Cloudflare R2 audio storage
- Cloudflare Workers with OpenNext for Cloudflare

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
PRONUNCIATION_API_URL=
PRONUNCIATION_API_TIMEOUT_MS=15000
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

The R2 values are optional for local practice. They are only needed when the user turns on **Save audio to R2**.

Personal Gemini keys are never sent to the backend. The browser uses them for direct Gemini requests. Users can choose **Remember this device** to store the key in local browser storage for convenience.

`PRONUNCIATION_API_URL` is optional. When set, the app calls `${PRONUNCIATION_API_URL}/assess` with the recorded audio and target sentence, stores the returned phoneme-level assessment, and gives Gemini that assessment as evidence for coaching. When unset or unavailable, practice still works with the existing Gemini transcript and feedback flow.

If users bring their own Gemini key, restrict it in Google AI Studio to your exact app origins, for example `https://app.tinywins.us/*` and `http://localhost:3000/*` for local testing.

Run locally:

```bash
npm run dev
```

## Supabase

1. Create a Supabase project.
2. Enable email auth.
3. Paste `seed/schema.sql` into the SQL editor and run it.
4. Paste `seed/items.sql` into the SQL editor and run it.
5. If you only need to add request limiting to an existing database, run `seed/rate-limit.sql`.
6. Copy the project URL and anon key into `.env.local`.

The schema enables RLS. `items` are readable by authenticated users, and every `recordings` policy is restricted with `auth.uid() = user_id`.

## Optional Cloudflare R2

By default, the browser sends the recorded audio directly to `/api/transcribe`, and the app does not keep the audio file. Users can still listen to their recording locally in the browser.

Enable R2 only if you want to keep audio files for later review.

1. Create an R2 bucket.
2. Create R2 API tokens with object read/write access for the bucket.
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.
4. Optionally configure a public/custom domain for reads and set `R2_PUBLIC_URL`.
5. Add CORS rules that allow browser `PUT` uploads from your local and production origins.

Example CORS rule:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3001", "http://127.0.0.1:3001"],
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
npm run pages:deploy
npm run secrets:scan
```

## Deploy To Cloudflare

Required GitHub repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
GEMINI_API_KEY
```

Optional GitHub repository secrets for **Save audio to R2**:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

The deploy workflow at `.github/workflows/deploy-cloudflare-pages.yml` runs typecheck, lint, Supabase migrations, OpenNext, uploads runtime secrets to the Cloudflare Worker, and deploys the already-built OpenNext output.

Database changes should be added as timestamped files under `supabase/migrations`. CI applies them with `supabase db push` before deploying code that depends on the new schema.

Manual build and deploy:

```bash
CLOUDFLARE_API_TOKEN=your-token CLOUDFLARE_ACCOUNT_ID=your-account-id \
npm run pages:deploy
```

Use a narrowly scoped Cloudflare API token with Workers edit access for this account.

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
- By default, `/api/transcribe` receives the browser audio directly and sends it to Gemini.
- If `PRONUNCIATION_API_URL` is configured, `/api/pronunciation-assess` proxies authenticated requests to the external FastAPI `/assess` service described in `pronunciation-api-prompt.md`.
- If the user enables **Save audio to R2**, the browser uploads audio through `/api/upload-url`, then `/api/transcribe` reads the private R2 object server-side.
- `/api/feedback` sends the transcript, target sentence, and optional pronunciation assessment to Gemini, validates the JSON response, then stores the attempt in Supabase.
- Topic and focus filters use tags in `items.tags`.
- Real Supabase and Gemini credentials are required to test the default flow. R2 credentials are required only for optional audio storage.
