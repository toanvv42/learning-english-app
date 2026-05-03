import os
import re
import subprocess
from pathlib import Path

import numpy as np

MODEL_ID = 'slplab/wav2vec2-large-robust-L2-english-phoneme-recognition'
TARGET_SR = 16000
ARPA_TO_IPA = {
    'aa': 'ɑ',
    'ae': 'æ',
    'ah': 'ʌ',
    'ao': 'ɔ',
    'aw': 'aʊ',
    'ay': 'aɪ',
    'b': 'b',
    'ch': 'tʃ',
    'd': 'd',
    'dh': 'ð',
    'eh': 'ɛ',
    'er': 'ɝ',
    'ey': 'eɪ',
    'f': 'f',
    'g': 'g',
    'hh': 'h',
    'ih': 'ɪ',
    'iy': 'i',
    'jh': 'dʒ',
    'k': 'k',
    'l': 'l',
    'm': 'm',
    'n': 'n',
    'ng': 'ŋ',
    'ow': 'oʊ',
    'oy': 'ɔɪ',
    'p': 'p',
    'r': 'ɹ',
    's': 's',
    'sh': 'ʃ',
    't': 't',
    'th': 'θ',
    'uh': 'ʊ',
    'uw': 'u',
    'v': 'v',
    'w': 'w',
    'y': 'j',
    'z': 'z',
    'zh': 'ʒ',
    'ax': 'ə',
}


def load_audio(path: str | Path) -> np.ndarray:
    result = subprocess.run(
        [
            'ffmpeg',
            '-v', 'error',
            '-i', str(path),
            '-f', 'f32le',
            '-acodec', 'pcm_f32le',
            '-ac', '1',
            '-ar', str(TARGET_SR),
            '-',
        ],
        check=True,
        capture_output=True,
    )
    audio = np.frombuffer(result.stdout, dtype=np.float32)

    if audio.size == 0:
        raise RuntimeError(f'no audio samples decoded from {path}')

    return audio


class PhonemeModel:
    loaded: bool = True

    def __init__(self, model_id: str | None = None, device: str | None = None):
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        self._torch = torch
        self.model_id = model_id or os.getenv('PHONEME_MODEL_ID', MODEL_ID)
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.processor = AutoProcessor.from_pretrained(self.model_id)
        self.model = AutoModelForCTC.from_pretrained(self.model_id).to(self.device)
        self.model.eval()

    def transcribe(self, audio_path: str | Path) -> tuple[str, list[str]]:
        torch = self._torch
        audio = load_audio(audio_path)
        inputs = self.processor(audio, sampling_rate=TARGET_SR, return_tensors='pt').to(self.device)

        with torch.no_grad():
            logits = self.model(**inputs).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        raw = self.processor.batch_decode(predicted_ids)[0]
        tokens = [token for token in re.split(r'\s+', raw.strip()) if token]
        return raw, tokens

    def infer(self, audio_path: str | Path) -> list[dict]:
        _, tokens = self.transcribe(audio_path)
        return [{'phoneme': normalize_model_token(token)} for token in tokens]

    def infer_phonemes(self, audio_path: str | Path) -> list[str]:
        _, tokens = self.transcribe(audio_path)
        return [normalize_model_token(token) for token in tokens]


def normalize_model_token(token: str) -> str:
    clean = token.replace('_err', '')
    return ARPA_TO_IPA.get(clean, clean)
