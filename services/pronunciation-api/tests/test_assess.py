import asyncio
import math
import wave
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.assessor import assess_pronunciation


client = TestClient(app)


def write_tone(path: Path, duration: float = 1.0, sample_rate: int = 16000) -> None:
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = bytearray()
        for i in range(int(duration * sample_rate)):
            value = int(9000 * math.sin(2 * math.pi * 220 * i / sample_rate))
            frames.extend(value.to_bytes(2, byteorder='little', signed=True))
        wav.writeframes(bytes(frames))


def write_silence(path: Path, duration: float = 1.0, sample_rate: int = 16000) -> None:
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b'\x00\x00' * int(duration * sample_rate))


def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'


def test_phonemes_validation():
    r = client.post('/phonemes', json={'text': ''})
    assert r.status_code == 400


def test_phonemes_requires_api_key_when_configured(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post('/phonemes', json={'text': 'hello'})

    assert r.status_code == 401
    assert r.json()['detail']['code'] == 'unauthorized'


def test_phonemes_rejects_wrong_api_key(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post(
        '/phonemes',
        headers={'Authorization': 'Bearer wrong-secret'},
        json={'text': 'hello'},
    )

    assert r.status_code == 401


def test_phonemes_accepts_correct_api_key(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post(
        '/phonemes',
        headers={'Authorization': 'Bearer test-secret'},
        json={'text': 'hello'},
    )

    assert r.status_code == 200
    assert r.json()['words'][0]['word'] == 'hello'


def test_assessment_uses_audio_without_fake_t(tmp_path):
    wav_path = tmp_path / 'tone.wav'
    write_tone(wav_path)

    result = asyncio.run(assess_pronunciation('I', wav_path, 1.0, 0.0))

    assert result['words'][0]['actual_phonemes'] == result['words'][0]['expected_phonemes']
    assert result['words'][0]['actual_phonemes'] != ['t']
    assert result['words'][0]['score'] == 100


def test_assessment_marks_silent_audio_missing(tmp_path):
    wav_path = tmp_path / 'silence.wav'
    write_silence(wav_path)

    result = asyncio.run(assess_pronunciation('hello', wav_path, 1.0, 0.0))

    assert result['words'][0]['actual_phonemes'] == []
    assert result['words'][0]['score'] == 0
