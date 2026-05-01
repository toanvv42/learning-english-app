# MVP Build Todo

## 1. Project Bootstrap

- [x] Initialize Next.js 15 app in the current directory.
- [x] Enable TypeScript strict mode.
- [x] Add Tailwind CSS.
- [x] Add Cloudflare Pages support with OpenNext for Cloudflare.
- [x] Add `.env.local.example`.
- [x] Add base scripts for dev, typecheck, lint, build, and Cloudflare build.

## 2. Supabase

- [x] Add browser Supabase client.
- [x] Add server Supabase client with cookie support.
- [x] Add auth middleware for `/practice` and `/history`.
- [x] Create SQL schema with RLS policies.
- [x] Add seed SQL with 20 starter items.

## 3. Authentication

- [x] Build `/login` page.
- [x] Support email sign-in/sign-up.
- [x] Redirect authenticated users to `/practice`.
- [x] Redirect unauthenticated protected routes to `/login`.

## 4. Storage

- [x] Add R2 S3-compatible client.
- [x] Build `POST /api/upload-url`.
- [x] Generate user-scoped object keys.
- [x] Upload audio directly from browser to R2.

## 5. Recording

- [x] Build `Recorder.tsx` with `MediaRecorder`.
- [x] Handle mic permission denied.
- [x] Show idle, recording, and stopped states.
- [x] Emit `audio/webm` blob.

## 6. Transcription

- [x] Add Gemini helper.
- [x] Build `POST /api/transcribe`.
- [x] Fetch recorded audio server-side.
- [x] Send audio to Gemini `gemini-2.5-flash`.
- [x] Handle empty transcript and API failures.

## 7. Gemini Feedback

- [x] Add `AIFeedback` TypeScript type.
- [x] Build Vietnamese-speaker-aware Gemini system prompt.
- [x] Call `gemini-2.5-flash`.
- [x] Strip markdown fences before JSON parsing.
- [x] Validate feedback shape.
- [x] Build `POST /api/feedback`.
- [x] Save recordings to Supabase.

## 8. Practice Flow

- [x] Build `/practice` page.
- [x] Load a target item.
- [x] Wire record -> upload -> transcribe -> feedback -> save.
- [x] Show loading states for each step.
- [x] Show friendly errors.
- [x] Allow another attempt.

## 9. History

- [x] Build `/history` page.
- [x] List current user recordings newest first.
- [x] Show target, transcript, score, issue, fix, and date.
- [x] Add empty state.

## 10. UI Polish

- [x] Keep layout mobile-friendly.
- [x] Add accessible labels.
- [x] Keep practice page bundle small.
- [x] Avoid heavy UI libraries.

## 11. Documentation

- [x] Add README setup steps.
- [x] Include Supabase SQL setup.
- [x] Include R2 setup.
- [x] Include required environment variables.
- [x] Include local dev instructions.
- [x] Include Cloudflare Pages deployment steps.

## 12. Verification

- [x] Run typecheck.
- [x] Run lint.
- [x] Run production build.
- [x] Run Cloudflare build if possible.
- [x] Document anything requiring real credentials.
