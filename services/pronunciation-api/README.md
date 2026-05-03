# Pronunciation API Service

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API
- `GET /health`
- `POST /phonemes`
- `POST /assess` (multipart with `audio`, `target_sentence`, `language`)
