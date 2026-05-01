# Build Prompt: English Pronunciation MVP for Vietnamese Speakers

You are a senior full-stack engineer. Build an MVP web app for a Vietnamese native speaker learning English pronunciation. Work end to end, verify API signatures against official docs when uncertain, and keep the implementation focused on the MVP only.

## Product Context

I am a Senior DevOps Engineer building a personal English learning app. My goals are to improve vocabulary, pronunciation, dropped ending sounds, and basic grammar. The broader learning approach is a fixed 20-minute daily loop:

1. Shadow a 1-minute audio clip.
2. Practice ending-sound minimal pairs.
3. Learn five new DevOps/cloud vocabulary words.
4. Practice one grammar micro-pattern.
5. Record 60 seconds of free speech.

For this MVP, build only the pronunciation feedback feature. Do not build the full daily loop yet.

The differentiator is AI-generated feedback personalized for Vietnamese-speaker pronunciation issues and my DevOps/cloud work context.

## MVP Scope

Build only this user flow:

1. User signs up or logs in with email.
2. User opens `/practice`.
3. User sees one target sentence, for example: `I deployed the fix to production yesterday.`
4. User clicks record, reads the sentence aloud, then clicks stop.
5. By default, browser sends the recorded audio directly to `/api/transcribe`.
6. If the user enables audio saving, browser uploads the recording to Cloudflare R2 through a presigned URL.
7. The backend transcribes the audio with Gemini.
8. The backend sends the target sentence and transcript to Gemini.
9. Gemini returns structured Vietnamese-speaker-aware feedback.
10. The app saves the attempt to Supabase.
11. User sees the target sentence, transcript, and one specific fix.
12. User opens `/history` and sees past attempts.

Explicitly out of scope:

- Spaced repetition
- Vocabulary module
- Grammar module
- Full daily-loop UI
- Batch processing
- Payments
- Social features
- Native mobile app
- Admin dashboard

## Non-Negotiable Tech Stack

- Frontend: Next.js 15 App Router, TypeScript, Tailwind CSS
- Hosting target: Cloudflare Pages
- Cloudflare adapter: OpenNext for Cloudflare
- Auth and database: Supabase Auth + Postgres
- File storage: optional Cloudflare R2 with S3-compatible SDK
- Pronunciation feedback: Gemini API using `gemini-2.5-flash`
- Transcription: Gemini API using `gemini-2.5-flash`
- Audio recording: Browser `MediaRecorder` API, no external recording library
- Local dev: `npm run dev`
- Secrets: `.env.local`

Do not suggest alternative providers or frameworks unless a required API is unavailable.

## Required User Experience

The app should feel like a compact personal practice tool, not a marketing site.

- First screen after login is the practice workflow.
- Mobile must be comfortable because I will use it on my phone.
- Every async operation needs visible loading state and error state.
- Recording state must be obvious.
- Feedback must focus on one fix, not a long lesson.
- Keep UI dense, calm, and practical.

## File Structure

Create this structure unless the framework requires a small adjustment:

```text
/app
  /api
    /feedback/route.ts
    /transcribe/route.ts
    /upload-url/route.ts
  /history
    page.tsx
  /login
    page.tsx
  /practice
    page.tsx
  globals.css
  layout.tsx
  page.tsx
  middleware.ts
/components
  FeedbackCard.tsx
  Recorder.tsx
  TargetSentence.tsx
/lib
  /gemini
    feedback.ts
  /r2
    client.ts
  /supabase
    client.ts
    server.ts
  /gemini
    transcribe.ts
/seed
  items.sql
/types
  feedback.ts
README.md
```

## Database Schema

Create SQL for Supabase with Row Level Security enabled. Every user-owned policy must restrict access with `auth.uid() = user_id`.

Required tables:

```sql
create table items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sentence', 'minimal_pair', 'vocab')),
  content text not null,
  difficulty int default 1 check (difficulty between 1 and 5),
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  audio_url text,
  transcript text not null,
  target_text text not null,
  ai_feedback jsonb not null,
  created_at timestamptz default now()
);

create index recordings_user_created on recordings(user_id, created_at desc);
```

RLS requirements:

- `items` can be read by authenticated users.
- `recordings` can be selected, inserted, updated, and deleted only by the owner.
- Insert policy must require `auth.uid() = user_id`.
- Include the final SQL in `README.md` or a separate setup section so I can paste it into Supabase.

## AI Feedback Contract

Gemini must return JSON in exactly this shape:

```json
{
  "overall_score": 7,
  "primary_issue": "ending_consonant",
  "what_you_said": "I deploy the fix to production yesterday",
  "what_was_expected": "I deployed the fix to production yesterday",
  "specific_fix": "You dropped the '-ed' at the end of 'deployed'. Vietnamese speakers often skip final consonants. Try saying 'deploy-DUH' to feel the ending.",
  "vietnamese_tip": "Trong tiếng Việt không có phụ âm cuối /d/, nên bạn cần tập phát âm rõ âm cuối này.",
  "encouragement": "Your sentence rhythm was good!"
}
```

Create a TypeScript type for this JSON in `/types/feedback.ts`.

Allowed `primary_issue` values:

- `ending_consonant`
- `past_tense_ed`
- `plural_s`
- `th_sound`
- `sh_sound`
- `ch_sound`
- `vowel_length`
- `grammar`
- `word_choice`
- `other`

Gemini system prompt requirements:

- The learner is a Vietnamese native speaker.
- Look especially for dropped final consonants: `/t/`, `/d/`, `/s/`, `/z/`, `/k/`, `-ed`, `-s`.
- Look for common substitutions: `/theta/` to `/t/` or `/s/`, `/sh/` to `/s/`, `/ch/` to `/s/`.
- Look for vowel length problems when transcript evidence suggests them.
- Compare the target sentence and Gemini transcript.
- Focus on one issue only: the most useful fix for the next attempt.
- Be encouraging but specific.
- `vietnamese_tip` must be in Vietnamese.
- Return pure JSON only. No markdown fences, no commentary.

Implementation requirements:

- Strip accidental markdown code fences before `JSON.parse`.
- Validate the parsed object shape before returning it to the client.
- If Gemini returns malformed JSON, return a useful API error and show a friendly UI message.

## API Routes

### `POST /api/upload-url`

Input:

```json
{
  "contentType": "audio/webm"
}
```

Output:

```json
{
  "uploadUrl": "https://...",
  "audioUrl": "https://...",
  "objectKey": "recordings/user-id/timestamp.webm"
}
```

Requirements:

- User must be authenticated.
- Generate an R2 presigned PUT URL.
- Use a user-scoped object key.
- Accept `audio/webm`.
- Do not proxy audio through Next.js.

### `POST /api/transcribe`

Input:

```json
{
  "audioUrl": "https://..."
}
```

Output:

```json
{
  "transcript": "I deploy the fix to production yesterday"
}
```

Requirements:

- User must be authenticated.
- Fetch the audio server-side from R2 or use a private object fetch strategy if public reads are not enabled.
- Send audio to Gemini `gemini-2.5-flash`.
- Handle empty transcript.
- Do not expose `GEMINI_API_KEY` to the client.

### `POST /api/feedback`

Input:

```json
{
  "itemId": "uuid",
  "targetText": "I deployed the fix to production yesterday.",
  "transcript": "I deploy the fix to production yesterday",
  "audioUrl": "https://..."
}
```

Output:

```json
{
  "recordingId": "uuid",
  "feedback": {
    "overall_score": 7,
    "primary_issue": "past_tense_ed",
    "what_you_said": "I deploy the fix to production yesterday",
    "what_was_expected": "I deployed the fix to production yesterday",
    "specific_fix": "You dropped the '-ed' at the end of 'deployed'. Try holding the final /d/ briefly.",
    "vietnamese_tip": "Trong tiếng Việt không có phụ âm cuối /d/ giống tiếng Anh, nên hãy cố phát âm rõ âm cuối.",
    "encouragement": "Your rhythm was clear."
  }
}
```

Requirements:

- User must be authenticated.
- Call Gemini server-side.
- Save the attempt in `recordings`.
- Return the saved `recordingId` and feedback.
- Do not expose `GEMINI_API_KEY` to the client.

## Pages

### `/login`

- Email sign-up/sign-in through Supabase.
- Simple, mobile-friendly UI.
- Redirect authenticated users to `/practice`.

### `/practice`

Required behavior:

- Require authentication.
- Load one starter item from Supabase.
- Display target sentence.
- Record with `MediaRecorder`.
- Upload audio to R2 via presigned URL.
- Call `/api/transcribe`.
- Call `/api/feedback`.
- Render feedback.
- Allow another attempt.

Required states:

- Loading item
- Microphone permission denied
- Recording
- Uploading
- Transcribing
- Generating feedback
- Saving attempt
- API failure
- Empty transcript

### `/history`

- Require authentication.
- List current user’s recordings newest first.
- Show date, target sentence, transcript, score, primary issue, and specific fix.
- Empty state when no recordings exist.

## Components

### `Recorder.tsx`

- Uses `MediaRecorder`.
- No third-party recording package.
- Emits a `Blob` when recording stops.
- Shows record/stop state.
- Handles permission errors cleanly.

### `TargetSentence.tsx`

- Displays the current sentence clearly.
- Keep layout stable on mobile.

### `FeedbackCard.tsx`

- Renders the structured feedback.
- Emphasize the single fix and Vietnamese tip.
- Do not show raw JSON unless useful during development.

## Environment Variables

Create `.env.local.example` with:

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

Keep `.env.local` out of git.

## Seed Data

Create `/seed/items.sql` with 20 starter rows:

- 10 past-tense DevOps sentences using: deployed, debugged, configured, merged, reviewed, fixed, pushed, rolled back, monitored, scaled.
- 5 minimal-pair style items contrasting present vs past or missing endings.
- 5 sentences with `/theta/`, `/sh/`, or `/ch/` sounds.

Use practical DevOps/cloud contexts.

## Quality Bar

- TypeScript strict mode.
- No `any` types.
- No API keys in client components.
- Server-side code only for Gemini, Supabase service role, and optional R2 signing.
- Accessible controls with labels.
- Mobile-friendly layout.
- Loading and error states for all async actions.
- Practice page client bundle should stay small; avoid heavy UI libraries.
- Use direct browser APIs where practical.
- Handle malformed AI responses.
- Handle network failures.
- Handle denied microphone permission.

## Cloudflare Pages

- Configure for Cloudflare Pages deployment.
- Include OpenNext for Cloudflare.
- Add a deploy/build command in `package.json`.
- Document deployment steps in `README.md`.

## Verification

Before finishing:

1. Run type check.
2. Run lint if configured.
3. Run production build.
4. Manually verify the main flow locally as far as possible without real secrets.
5. Document any unverified steps that require real Supabase, R2, or Gemini credentials.

## Definition of Done

The MVP is done when I can:

1. Sign up or sign in with email.
2. Open `/practice`.
3. See a target sentence.
4. Click record, read aloud, and stop.
5. See upload, transcription, and feedback states.
6. Within about 5 seconds after upload/transcription, see transcript and AI feedback.
7. See one concrete fix focused on Vietnamese-speaker pronunciation or grammar.
8. Open `/history`.
9. See all my past attempts.
10. Deploy to Cloudflare Pages with documented commands.

## Work Order

Start by giving me a concise checklist and ask at most one clarifying question only if something blocks implementation. Then begin.

Implementation order:

1. Initialize the Next.js project and install dependencies.
2. Add TypeScript, Tailwind, Cloudflare Pages, and environment examples.
3. Add Supabase clients and auth middleware.
4. Create login, root redirect, practice, and history pages.
5. Add R2 client and `/api/upload-url`.
6. Add `Recorder`.
7. Add Gemini transcription helper and `/api/transcribe`.
8. Add Gemini helper and `/api/feedback`.
9. Wire the practice workflow end to end.
10. Add Supabase schema and seed SQL.
11. Add README setup and deployment instructions.
12. Run verification commands and report results.

## Important Constraint

If an API signature, package version, or provider behavior is uncertain, verify it from official documentation instead of guessing.
