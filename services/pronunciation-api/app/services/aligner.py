def align_words(target_sentence: str, duration_seconds: float) -> list[dict]:
    words = target_sentence.split()
    if not words:
        return []
    window = duration_seconds / len(words)
    return [
        {'word': w, 'start': i * window, 'end': (i + 1) * window}
        for i, w in enumerate(words)
    ]
