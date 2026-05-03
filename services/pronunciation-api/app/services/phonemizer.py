
PHONEME_MAP = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'world': ['w', 'ɝ', 'l', 'd'],
    'think': ['θ', 'ɪ', 'ŋ', 'k'],
}


def phonemize_text(text: str, language: str = 'en-us') -> tuple[str, list[dict]]:
    words = []
    ipa_words = []
    for word in text.lower().split():
        ph = PHONEME_MAP.get(word, list(word))
        words.append({'word': word, 'phonemes': ph})
        ipa_words.append(''.join(ph))
    return ' '.join(ipa_words), words
