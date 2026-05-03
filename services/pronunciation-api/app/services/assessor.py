import asyncio
import math
import time
from dataclasses import dataclass
from pathlib import Path

from app.services.audio import read_mono_pcm16
from app.services.phonemizer import phonemize_text
from app.utils.diff import diff_phonemes


@dataclass
class AlignmentOp:
    op: str
    expected: str | None
    actual: str | None


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


def align_phonemes(expected: list[str], actual: list[str]) -> list[AlignmentOp]:
    n, m = len(expected), len(actual)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if expected[i - 1] == actual[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )

    ops: list[AlignmentOp] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and expected[i - 1] == actual[j - 1]:
            ops.append(AlignmentOp('match', expected[i - 1], actual[j - 1]))
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            ops.append(AlignmentOp('sub', expected[i - 1], actual[j - 1]))
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append(AlignmentOp('del', expected[i - 1], None))
            i -= 1
        else:
            ops.append(AlignmentOp('ins', None, actual[j - 1]))
            j -= 1

    ops.reverse()
    return ops


def phoneme_score(ops: list[AlignmentOp]) -> int:
    expected_count = sum(1 for op in ops if op.expected)
    errors = sum(1 for op in ops if op.op != 'match')

    if expected_count == 0:
        return 0

    return max(0, min(100, int(round(100 * (1 - errors / expected_count)))))


def actual_speech_phonemes(wav_path: Path) -> list[str]:
    from app.main import state
    from app.models.loader import load_models

    segments = speech_segments(wav_path)
    if not segments:
        return []

    if state.get('models') is None:
        state['models'] = load_models()

    model = (state.get('models') or {}).get('phoneme_model')
    if model is None:
        return []

    if hasattr(model, 'infer_phonemes'):
        return list(model.infer_phonemes(str(wav_path)))

    return [
        item['phoneme']
        for item in model.infer(str(wav_path))
        if isinstance(item, dict) and isinstance(item.get('phoneme'), str)
    ]


def build_word_results(expected_words: list[dict], actual: list[str]) -> list[dict]:
    flattened_expected = [
        phoneme
        for item in expected_words
        for phoneme in item['phonemes']
    ]
    ops = align_phonemes(flattened_expected, actual)
    results = []
    cursor = 0

    for item in expected_words:
        expected = item['phonemes']
        word_ops = []

        while cursor < len(ops) and len([op for op in word_ops if op.expected]) < len(expected):
            word_ops.append(ops[cursor])
            cursor += 1

        word_actual = [op.actual for op in word_ops if op.actual]
        errors = [
            {
                'position': index,
                'expected': op.expected or '',
                'actual': op.actual or '',
                'tip': diff_phonemes([op.expected or ''], [op.actual or ''])[1][0]['tip'],
            }
            for index, op in enumerate(word_ops)
            if op.op != 'match' and op.expected
        ]

        results.append({
            'word': item['word'],
            'expected_phonemes': expected,
            'actual_phonemes': word_actual,
            'score': phoneme_score(word_ops),
            'errors': errors,
        })

    return results


async def assess_pronunciation(
    target_sentence: str,
    wav_path: Path,
    duration_seconds: float,
    processing_started: float,
) -> dict:
    ipa, expected_words = await asyncio.to_thread(phonemize_text, target_sentence)
    _ = ipa
    segments = await asyncio.to_thread(speech_segments, wav_path)
    actual = await asyncio.to_thread(actual_speech_phonemes, wav_path)
    word_results = build_word_results(expected_words, actual)
    total_expected = sum(len(item['expected_phonemes']) for item in word_results)
    weighted_score = sum(item['score'] * len(item['expected_phonemes']) for item in word_results)
    overall = int(round(weighted_score / max(total_expected, 1)))
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
