import asyncio
import math
import time
from pathlib import Path

from app.services.audio import read_mono_pcm16
from app.services.phonemizer import phonemize_text
from app.services.aligner import align_words
from app.utils.diff import diff_phonemes


def frame_rms(samples: list[int]) -> float:
    if not samples:
        return 0.0
    return math.sqrt(sum(sample * sample for sample in samples) / len(samples))


def speech_segments(wav_path: Path, frame_ms: int = 30) -> list[dict]:
    sample_rate, samples = read_mono_pcm16(wav_path)
    frame_size = max(1, int(sample_rate * frame_ms / 1000))
    frames = []

    for start in range(0, len(samples), frame_size):
        end = min(start + frame_size, len(samples))
        frames.append({
            'start': start / sample_rate,
            'end': end / sample_rate,
            'rms': frame_rms(samples[start:end]),
        })

    if not frames:
        return []

    peak = max(frame['rms'] for frame in frames)
    noise = sorted(frame['rms'] for frame in frames)[max(0, int(len(frames) * 0.2) - 1)]
    threshold = max(120.0, min(noise * 3.0, peak * 0.08))
    voiced = [frame for frame in frames if frame['rms'] >= threshold]

    segments = []
    for frame in voiced:
        if segments and frame['start'] - segments[-1]['end'] <= 0.09:
            segments[-1]['end'] = frame['end']
        else:
            segments.append({'start': frame['start'], 'end': frame['end']})

    return [segment for segment in segments if segment['end'] - segment['start'] >= 0.06]


def overlap_seconds(start: float, end: float, segments: list[dict]) -> float:
    total = 0.0
    for segment in segments:
        total += max(0.0, min(end, segment['end']) - max(start, segment['start']))
    return total


def estimated_actual_phonemes(expected: list[str], coverage: float) -> list[str]:
    if coverage >= 0.55:
        return expected[:]
    if coverage >= 0.25:
        keep = max(1, int(round(len(expected) * coverage)))
        return expected[:keep]
    return []


async def assess_pronunciation(
    target_sentence: str,
    wav_path: Path,
    duration_seconds: float,
    processing_started: float,
) -> dict:
    ipa, expected_words = await asyncio.to_thread(phonemize_text, target_sentence)
    _ = ipa
    spans = await asyncio.to_thread(align_words, target_sentence, duration_seconds)
    segments = await asyncio.to_thread(speech_segments, wav_path)
    word_results = []
    total = 0
    for idx, item in enumerate(expected_words):
        expected = item['phonemes']
        span = spans[idx] if idx < len(spans) else {'start': 0.0, 'end': duration_seconds}
        span_duration = max(span['end'] - span['start'], 0.01)
        coverage = min(1.0, overlap_seconds(span['start'], span['end'], segments) / span_duration)
        actual = estimated_actual_phonemes(expected, coverage)
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
    speech_time = sum(segment['end'] - segment['start'] for segment in segments)
    coverage_ratio = speech_time / max(duration_seconds, 0.01)
    long_pauses = sum(
        1 for prev, current in zip(segments, segments[1:])
        if current['start'] - prev['end'] > 0.45
    )
    fluency = max(0, min(100, int((coverage_ratio * 100) - (long_pauses * 8))))
    return {
        'overall_score': overall,
        'words': word_results,
        'fluency_score': fluency,
        'duration_seconds': duration_seconds,
        'processing_time_ms': int((time.perf_counter() - processing_started) * 1000),
    }
