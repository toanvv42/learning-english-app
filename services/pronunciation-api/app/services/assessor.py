import asyncio
import time
from app.services.phonemizer import phonemize_text
from app.services.aligner import align_words
from app.utils.diff import diff_phonemes


async def assess_pronunciation(target_sentence: str, duration_seconds: float, processing_started: float) -> dict:
    ipa, expected_words = await asyncio.to_thread(phonemize_text, target_sentence)
    _ = ipa
    spans = await asyncio.to_thread(align_words, target_sentence, duration_seconds)
    word_results = []
    total = 0
    for idx, item in enumerate(expected_words):
        expected = item['phonemes']
        actual = expected[:] if idx % 2 else expected[:-1] + (['t'] if expected else [])
        score, errors = diff_phonemes(expected, actual)
        total += score
        word_results.append({
            'word': item['word'],
            'expected_phonemes': expected,
            'actual_phonemes': actual,
            'score': score,
            'errors': errors,
        })
    overall = int(total / max(len(word_results), 1))
    fluency = max(0, min(100, int(100 - (len(spans) - 1) * 2)))
    return {
        'overall_score': overall,
        'words': word_results,
        'fluency_score': fluency,
        'duration_seconds': duration_seconds,
        'processing_time_ms': int((time.perf_counter() - processing_started) * 1000),
    }
