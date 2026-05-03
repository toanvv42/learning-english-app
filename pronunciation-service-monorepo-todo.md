# Codex Cloud Task: Build Pronunciation Assessment Service In This Monorepo

## Goal

Build the pronunciation assessment API described in `pronunciation-api-prompt.md` inside this repository using a monorepo layout.

The current Next.js app already has v1 integration hooks:

- `app/api/pronunciation-assess/route.ts` proxies authenticated app requests to `${PRONUNCIATION_API_URL}/assess`
- `app/practice/PracticeClient.tsx` calls pronunciation assessment alongside transcription
- `lib/gemini/feedback.ts` and `app/practice/browserGemini.ts` pass assessment evidence into Gemini coaching
- `components/FeedbackCard.tsx` renders word-level sound evidence
- `types/feedback.ts` contains `PronunciationAssessment`
- `supabase/migrations/202605030001_pronunciation_assessments.sql` stores assessment JSON

Now implement the actual external service in this same repo.

## Required Layout

Create:

```text
services/
  pronunciation-api/
    app/
      main.py
      models/
        loader.py
        phoneme_model.py
      services/
        assessor.py
        aligner.py
        phonemizer.py
        audio.py
      schemas/
        assessment.py
      utils/
        diff.py
        tips.py
        logging.py
    tests/
      test_assess.py
      test_phonemizer.py
      test_diff.py
      fixtures/
    Dockerfile
    docker-compose.yml
    requirements.txt
    README.md
```

Keep the Python service deployable as a separate Docker container. Do not try to run ML code inside the Next.js or Cloudflare runtime.

## API Contract

Implement:

### `POST /assess`

Request: multipart form data

- `audio`: WAV, MP3, M4A, or WebM
- `target_sentence`: non-empty string
- `language`: optional, default `en-us`

Response:

```json
{
  "overall_score": 72,
  "words": [
    {
      "word": "think",
      "expected_phonemes": ["θ", "ɪ", "ŋ", "k"],
      "actual_phonemes": ["t", "ɪ", "ŋ", "k"],
      "score": 70,
      "errors": [
        {
          "position": 0,
          "expected": "θ",
          "actual": "t",
          "tip": "Place your tongue between your teeth for the 'th' sound"
        }
      ]
    }
  ],
  "fluency_score": 85,
  "duration_seconds": 1.8,
  "processing_time_ms": 1240
}
```

### `GET /health`

```json
{
  "status": "ok",
  "models_loaded": true,
  "uptime_seconds": 1234
}
```

### `POST /phonemes`

Request:

```json
{
  "text": "hello world",
  "language": "en-us"
}
```

Response:

```json
{
  "ipa": "həˈloʊ wɜːld",
  "words": [
    {
      "word": "hello",
      "phonemes": ["h", "ə", "l", "oʊ"]
    }
  ]
}
```

## Pipeline

Follow the two-stage design from `pronunciation-api-prompt.md`:

1. Forced alignment:
   - Input: audio + known `target_sentence`
   - Output: word-level time spans
   - Use WhisperX alignment model.

2. Phoneme recognition:
   - Input: full audio
   - Output: frame-level IPA phoneme sequence with timestamps
   - Use `facebook/wav2vec2-lv-60-espeak-cv-ft`.

3. Slice recognized phonemes by word spans.

4. Generate expected phonemes for each target word using `phonemizer` + `espeak-ng`.

5. Diff expected vs actual phoneme sequences.

6. Return scores, errors, and Vietnamese-speaker tips.

## Implementation Requirements

- Use FastAPI and Pydantic v2.
- Load ML models once at startup with FastAPI lifespan events.
- Do not lazy-load models on the first request.
- Use `asyncio.to_thread()` for CPU-bound inference.
- Accept WAV, MP3, M4A, and WebM.
- Use ffmpeg to convert all input to 16kHz mono WAV.
- Reject audio shorter than `0.5s` or longer than `60s`.
- Use structured JSON errors:
  - `400`: invalid request, unsupported audio, empty target sentence
  - `422`: audio too short/long or no speech detected
  - `500`: model inference failure, no stack trace in response
- Include `processing_time_ms` in every `/assess` response.
- Log a warning when one assessment takes over 5 seconds.
- Use stdlib `logging` with `python-json-logger`.
- Required log fields: `timestamp`, `level`, `logger`, `message`, and `request_id` when available.

## Diff And Tips

Use `panphon.distance.Distance().weighted_feature_edit_distance()` when available.

Fallback if PanPhon is unavailable:

- Implement a simple weighted Levenshtein diff.
- Use substitution cost `0` for identical phonemes.
- Use substitution cost `1` for unrelated phonemes.
- Add lower-cost/common Vietnamese-English confusion support for:
  - `/θ/ -> /t/` or `/d/`
  - `/ð/ -> /d/` or `/z/`
  - `/æ/ -> /ɛ/` or `/a/`
  - `/ɹ/ -> /r/`
  - `/z/ -> /s/`
  - `/v/ -> /b/` or `/f/`
  - `/ʃ/ -> /s/`
  - `/tʃ/ -> /t/` or `/ʃ/`

Tips:

- `/θ/ -> /t/` or `/d/`: `Place your tongue between your teeth for the 'th' sound`
- `/ð/ -> /d/` or `/z/`: `Voiced 'th' — tongue between teeth, vibrate your vocal cords`
- `/æ/ -> /ɛ/` or `/a/`: `Open your mouth wider, drop your tongue lower`
- `/ɹ/ -> /r/`: `English 'r' — pull tongue back, no trill or tap`
- `/z/ -> /s/`: `Add voicing — your throat should vibrate`
- `/v/ -> /b/` or `/f/`: `Lower lip touches upper teeth, then add voice`
- `/ʃ/ -> /s/`: `Round your lips, pull tongue back from teeth`
- `/tʃ/ -> /t/` or `/ʃ/`: `Stop the air completely, then release with friction`
- Dropped final `/s/`, `/z/`, `/t/`, `/d/`: `Don't swallow the final consonant — release it clearly`
- Final consonant cluster simplified: `Pronounce every consonant at the end, not just the last one`

## Docker

Add a Dockerfile under `services/pronunciation-api/`.

System packages required:

- `ffmpeg`
- `espeak-ng`
- `libsndfile1`

Use `python:3.11-slim`.

Add `docker-compose.yml` for local development:

- expose service on `localhost:8000`
- mount HuggingFace cache as a volume
- set environment variables for CPU/GPU mode if needed

## Root Repo Integration

Update root `package.json` scripts:

```json
{
  "dev:pronunciation": "cd services/pronunciation-api && uvicorn app.main:app --reload --port 8000",
  "test:pronunciation": "cd services/pronunciation-api && pytest",
  "docker:pronunciation": "docker compose -f services/pronunciation-api/docker-compose.yml up --build"
}
```

Do not break existing scripts.

Update root `README.md` with:

- how to run the pronunciation service locally
- how to set `PRONUNCIATION_API_URL=http://localhost:8000`
- how the Next.js app calls `/api/pronunciation-assess`
- deployment note: Next app and pronunciation API deploy separately

## Testing

Add pytest tests for:

- `GET /health`
- `POST /phonemes`
- `POST /assess`
- phoneme diff algorithm
- Vietnamese confusion tips

Mock heavy ML models in CI/unit tests. Do not require real model downloads for the default test suite.

Suggested approach:

- Make `models/loader.py` expose a model bundle object.
- In tests, monkeypatch the bundle with deterministic fake aligner and fake phoneme recognizer.
- Include at least one tiny WAV fixture under `tests/fixtures/`.

## Acceptance Criteria

The task is complete when:

1. `services/pronunciation-api` exists with a working FastAPI app.
2. The service responds to `/health`, `/phonemes`, and `/assess`.
3. `/assess` returns JSON compatible with `types/feedback.ts` `PronunciationAssessment`.
4. The service can run locally on port `8000`.
5. Root README explains how to run both apps together.
6. Root scripts are added without breaking existing scripts.
7. Tests pass for the Python service without downloading real ML models.
8. Existing Next.js checks still pass:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`

## Important Notes

- Keep this as v1. Ship a working, testable pipeline with clear seams for model quality improvements later.
- Do not add auth, API keys, persistence, user accounts, queues, streaming, or multi-language support to the FastAPI service.
- The current Next app already handles auth, Supabase, rate limiting, and persistence.
- If real WhisperX/wav2vec2 integration is too heavy to fully validate in local tests, implement the production code path but keep tests mocked.
- Preserve existing untracked files unless the user explicitly asks otherwise.
