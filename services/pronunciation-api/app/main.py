import logging
import os
import secrets
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.models.loader import load_models
from app.schemas.assessment import AssessmentResponse, HealthResponse, PhonemesRequest, PhonemesResponse
from app.services.assessor import assess_pronunciation
from app.services.audio import convert_to_wav, get_duration_seconds
from app.services.phonemizer import phonemize_text
from app.utils.logging import configure_logging

configure_logging()
logger = logging.getLogger('pronunciation-api')
state = {'started_at': time.time(), 'models': None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    state['models'] = load_models()
    yield


app = FastAPI(title='Pronunciation API', lifespan=lifespan)


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    configured_key = os.getenv('PRONUNCIATION_API_KEY')
    if not configured_key:
        return

    scheme, _, token = (authorization or '').partition(' ')
    if scheme.lower() != 'bearer' or not secrets.compare_digest(token, configured_key):
        raise HTTPException(
            status_code=401,
            detail={'code': 'unauthorized', 'message': 'invalid API key'},
        )


@app.get('/health', response_model=HealthResponse)
async def health():
    return {
        'status': 'ok',
        'models_loaded': state['models'] is not None,
        'uptime_seconds': int(time.time() - state['started_at']),
    }


@app.post('/phonemes', response_model=PhonemesResponse, dependencies=[Depends(require_api_key)])
async def phonemes(payload: PhonemesRequest):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail={'code': 'invalid_request', 'message': 'text must not be empty'})
    ipa, words = phonemize_text(payload.text, payload.language)
    return {'ipa': ipa, 'words': words}


@app.post('/assess', response_model=AssessmentResponse, dependencies=[Depends(require_api_key)])
async def assess(audio: UploadFile = File(...), target_sentence: str = Form(...), language: str = Form('en-us')):
    _ = language
    started = time.perf_counter()
    if not target_sentence.strip():
        raise HTTPException(status_code=400, detail={'code': 'invalid_request', 'message': 'target_sentence must not be empty'})
    suffix = Path(audio.filename or 'audio.wav').suffix or '.wav'
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / f'in{suffix}'
        wav = Path(tmp) / 'normalized.wav'
        raw.write_bytes(await audio.read())
        try:
            convert_to_wav(raw, wav)
        except Exception:
            raise HTTPException(status_code=400, detail={'code': 'unsupported_audio', 'message': 'unsupported or invalid audio file'})
        duration = get_duration_seconds(wav)
        if duration < 0.5 or duration > 60:
            raise HTTPException(status_code=422, detail={'code': 'invalid_duration', 'message': 'audio must be between 0.5s and 60s'})

        result = await assess_pronunciation(target_sentence, wav, duration, started)

    if result['processing_time_ms'] > 5000:
        logger.warning('slow_assessment', extra={'request_id': None, 'processing_time_ms': result['processing_time_ms']})
    return JSONResponse(result)
