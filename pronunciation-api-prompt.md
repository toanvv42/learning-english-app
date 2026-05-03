# Build a Pronunciation Assessment API

You are an expert Python backend engineer specialising in speech processing and machine learning. Build a production-quality pronunciation assessment REST API from scratch.

---

## PROJECT GOAL

A FastAPI service that accepts an audio recording of someone speaking a known target sentence and returns detailed pronunciation feedback at the phoneme level — identifying which sounds were correct, mispronounced, or missing.

The primary user is a Vietnamese speaker learning English, so the system must be robust to heavily accented L2 speech.

---

## NON-GOALS (v1)

Explicitly out of scope. Do not build, stub, or reference these:

- Authentication, API keys, rate limiting (assume an API gateway handles this)
- Persistent storage of assessments — the service is stateless
- User accounts, multi-tenancy, per-user history
- Long-running job queues — all requests are synchronous, audio is capped at 60s
- Streaming audio input — file upload only
- Languages other than English variants
- Real-time feedback during recording

---

## CLARIFICATIONS

- **`language` parameter** refers to the target language being assessed (the language of `target_sentence`). The speaker's L1 is not a parameter — error tips assume Vietnamese L1 by default. Treat `language` as the espeak/phonemizer locale (e.g. `en-us`, `en-gb`).
- **Logging**: use Python's stdlib `logging` configured with `python-json-logger` to emit one JSON object per log line. Required fields: `timestamp`, `level`, `logger`, `message`, `request_id` (when in request context).
- **System dependencies for Docker**: `ffmpeg`, `espeak-ng`, and `libsndfile1` must be installed via `apt-get`. `phonemizer` silently fails without `espeak-ng`.
- **M4A support**: ensure ffmpeg is built with AAC decoding. The default ffmpeg apt package on `python:3.11-slim` handles this.
- **Quality bar**: this is a v1. Phoneme accuracy on accented speech is best-effort. Do not over-engineer the ML quality — ship a working pipeline and iterate from real user data.

---

## TECH STACK

The system needs two distinct capabilities that work together:

### Capability 1 — Phoneme recognition (what sounds did the user actually produce?)

Use `facebook/wav2vec2-lv-60-espeak-cv-ft`. It classifies raw audio into IPA phonemes frame-by-frame without going through word recognition, making it robust to L2 accents. This produces a flat sequence of recognised phonemes for the whole utterance, with frame-level timestamps.

### Capability 2 — Word alignment (which phonemes belong to which word?)

The phoneme model alone cannot tell you which frames correspond to which word. For per-word feedback, run forced alignment using WhisperX's alignment model (wav2vec2-based, no transcription needed — feed it the known target text + audio to get word-level timestamps).

### How they compose

1. Run forced alignment on `(audio, target_sentence)` → word-level time spans
2. Run the phoneme model on the full audio → frame-level IPA sequence with timestamps
3. Slice the phoneme sequence by the word time spans to get per-word actual phonemes
4. Run `phonemizer` on each target word to get expected phonemes
5. Diff expected vs actual per word

Document this two-stage pipeline in the README. The two models are not fallbacks for each other — they do different jobs.

---

## API SPECIFICATION

### `POST /assess`

**Request** (multipart/form-data):
- `audio`: audio file (WAV, MP3, M4A, or WebM)
- `target_sentence`: string — the sentence the user was trying to say
- `language`: string — default `"en-us"`

**Response** (JSON):
```json
{
  "overall_score": 72,
  "words": [
    {
      "word": "think",
      "expected_phonemes": ["θ", "ɪ", "ŋ", "k"],
      "actual_phonemes":   ["t", "ɪ", "ŋ", "k"],
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

**Worked example.** Input: a WAV of a Vietnamese speaker saying "I think so", `target_sentence="I think so"`, `language="en-us"`. Expected response:

```json
{
  "overall_score": 72,
  "words": [
    {
      "word": "I",
      "expected_phonemes": ["aɪ"],
      "actual_phonemes": ["aɪ"],
      "score": 100,
      "errors": []
    },
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
    },
    {
      "word": "so",
      "expected_phonemes": ["s", "oʊ"],
      "actual_phonemes": ["s", "oʊ"],
      "score": 100,
      "errors": []
    }
  ],
  "fluency_score": 85,
  "duration_seconds": 1.8,
  "processing_time_ms": 1240
}
```

### `GET /health`

Returns service status and model load state:
```json
{ "status": "ok", "models_loaded": true, "uptime_seconds": 1234 }
```

### `POST /phonemes`

Helper endpoint: converts text to IPA phonemes.

**Request:** `{ "text": "hello world", "language": "en-us" }`
**Response:** `{ "ipa": "həˈloʊ wɜːld", "words": [{"word": "hello", "phonemes": ["h", "ə", "l", "oʊ"]}, ...] }`

---

## PROJECT STRUCTURE

```
pronunciation-api/
├── app/
│   ├── main.py               # FastAPI app, routes, lifespan events
│   ├── models/
│   │   ├── loader.py         # Load and cache ML models at startup
│   │   └── phoneme_model.py  # wav2vec2 phoneme inference wrapper
│   ├── services/
│   │   ├── assessor.py       # Core assessment logic — wires everything
│   │   ├── aligner.py        # WhisperX forced alignment for word boundaries
│   │   ├── phonemizer.py     # Text → IPA via phonemizer
│   │   └── audio.py          # Audio preprocessing (resample, denoise, validate)
│   ├── schemas/
│   │   └── assessment.py     # Pydantic v2 request/response models
│   └── utils/
│       ├── diff.py           # Phoneme sequence diff (panphon-weighted Levenshtein)
│       ├── tips.py           # Phoneme error → human-readable tip mapping
│       └── logging.py        # JSON logger setup
├── tests/
│   ├── test_assess.py
│   ├── test_phonemizer.py
│   ├── test_diff.py
│   └── fixtures/             # Sample WAV files
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## PRODUCTION REQUIREMENTS

### Audio preprocessing
- Accept WAV, MP3, M4A, WebM — auto-convert to 16kHz mono WAV using ffmpeg
- Validate: reject files over 60 seconds or under 0.5 seconds
- Apply a basic noise gate to trim silence at start/end

### Model loading
- Load all ML models once at startup via FastAPI lifespan events — never on first request
- Cache models in memory; never reload between requests
- Log model load time at startup

### Error handling
- Return structured JSON errors with appropriate HTTP status codes
- 400: invalid audio, unsupported format, empty target sentence
- 422: audio too short/long, no speech detected
- 500: model inference failure with a safe error message — no stack traces in production responses

### Performance
- Target p95 latency under 5 seconds for a 10-second audio clip on a 4-core CPU with 8GB RAM, using the unquantised model
- For sub-2s p95, deploy on GPU OR convert the model to ONNX with int8 quantisation. Document this as an optional optimisation in the README, not a default
- Use async endpoints with `asyncio.to_thread()` for CPU-bound inference so the event loop is never blocked
- Include `processing_time_ms` in every response, measured from request receipt to response serialisation
- Log a warning when any single request exceeds 5s

### Phoneme diff algorithm

Use Levenshtein edit distance on phoneme sequences with substitution costs derived from articulatory features:

1. **Use PanPhon** (`pip install panphon`) — provides feature-based distance between IPA phonemes out of the box. Use `panphon.distance.Distance().weighted_feature_edit_distance()`.
2. If PanPhon fails to install, fall back to a hand-coded substitution cost matrix for the ~15 most common Vietnamese→English confusion pairs (listed below); all other substitutions cost 1.0.

Insertion and deletion both cost 1.0. Substitution cost ranges 0.0 (identical) to 1.0 (maximally dissimilar).

### Vietnamese→English error patterns and tips

Map these phoneme errors to specific tips:

- /θ/ → /t/ or /d/  : "Place your tongue between your teeth for the 'th' sound"
- /ð/ → /d/ or /z/  : "Voiced 'th' — tongue between teeth, vibrate your vocal cords"
- /æ/ → /ɛ/ or /a/  : "Open your mouth wider, drop your tongue lower"
- /ɹ/ → /r/ (trill) : "English 'r' — pull tongue back, no trill or tap"
- /z/ → /s/         : "Add voicing — your throat should vibrate"
- /v/ → /b/ or /f/  : "Lower lip touches upper teeth, then add voice"
- /ʃ/ → /s/         : "Round your lips, pull tongue back from teeth"
- /tʃ/ → /t/ or /ʃ/ : "Stop the air completely, then release with friction"
- Final /s/, /z/, /t/, /d/ dropped: "Don't swallow the final consonant — release it clearly"
- Final consonant clusters simplified: "Pronounce every consonant at the end, not just the last one"

### Testing
- pytest tests for all three endpoints
- At least one real WAV fixture per endpoint test
- Mock ML models in unit tests — do not load real models in CI
- Test the phoneme diff algorithm independently with known inputs/outputs (including the Vietnamese error patterns above)

### Docker
- Multi-stage Dockerfile: builder installs deps, final image is lean
- Builder stage installs `ffmpeg`, `espeak-ng`, `libsndfile1` via apt
- `docker-compose.yml` with a volume mount for the HuggingFace model cache (`~/.cache/huggingface`)
- Document GPU vs CPU environment variables

### README
- Setup instructions (local + Docker)
- Explain the two-stage pipeline (phoneme recognition + forced alignment)
- Document all environment variables
- A `curl` example for each endpoint
- Note known limitations (American English bias, audio quality sensitivity, no streaming)
- Note the optional ONNX/quantisation path for sub-2s latency

---

## CONSTRAINTS

- Python 3.11+
- FastAPI with `async/await` throughout
- Pydantic v2 for all schemas
- Use `asyncio.to_thread()` for CPU-bound inference inside async routes — never use sync `def` routes
- Use `python-json-logger` for structured logs; do not invent a custom log format
- Use `panphon` for phoneme similarity; do not hand-roll a feature matrix unless panphon fails to install
- Pin all dependencies in `requirements.txt` with exact versions (`==`), not ranges
- No hardcoded paths — environment variables with sensible defaults
- All secrets and config via environment variables
- Type hints on every function
- Docstrings on every public function and class
- No `print()` — use the configured JSON logger

---

## DELIVERABLES

Build the project in this order. After each file, state what was built and what comes next. Do not skip ahead.

1. Project scaffold and `requirements.txt`
2. Pydantic schemas
3. JSON logging setup
4. Audio preprocessing service
5. Phonemizer wrapper
6. ML model loader and inference wrapper
7. WhisperX aligner wrapper
8. Phoneme diff algorithm + tip mapping
9. Core assessor service (wires everything together)
10. FastAPI routes and lifespan events
11. Tests
12. Dockerfile + docker-compose
13. README
