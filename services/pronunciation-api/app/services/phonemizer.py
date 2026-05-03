
import re
import shutil
import subprocess
import unicodedata

PHONEME_MAP = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'world': ['w', 'ɝ', 'l', 'd'],
    'think': ['θ', 'ɪ', 'ŋ', 'k'],
}

COMBINING_MARKS = {'ˈ', 'ˌ', 'ː', 'ˑ', '̃', '̩', '̯', '\u200d'}
IPA_CLUSTERS = [
    'tʃ', 'dʒ', 'aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ', 'əʊ', 'ɪə', 'eə', 'ʊə',
]


def normalize_word(word: str) -> str:
    return re.sub(r"(^[^\w']+|[^\w']+$)", '', word.lower())


def tokenize_ipa(ipa: str) -> list[str]:
    normalized = unicodedata.normalize('NFC', ipa)
    cleaned = ''.join(ch for ch in normalized if ch not in COMBINING_MARKS)
    phonemes = []
    i = 0
    while i < len(cleaned):
        if cleaned[i].isspace():
            i += 1
            continue

        cluster = next((item for item in IPA_CLUSTERS if cleaned.startswith(item, i)), None)
        if cluster:
            phonemes.append(cluster)
            i += len(cluster)
            continue

        if cleaned[i].isalpha() or cleaned[i] in {'ə', 'θ', 'ð', 'ŋ', 'ʃ', 'ʒ', 'ɹ', 'ɝ', 'ɚ', 'æ', 'ɑ', 'ɔ', 'ɛ', 'ɪ', 'ʊ'}:
            phonemes.append(cleaned[i])
        i += 1
    return phonemes


def espeak_ipa_words(text: str, language: str) -> list[list[str]]:
    if not shutil.which('espeak-ng'):
        return []

    voice = 'en-us' if language.lower() in {'en-us', 'en'} else language
    completed = subprocess.run(
        ['espeak-ng', '--ipa=3', '-q', '-v', voice, text],
        check=True,
        capture_output=True,
        text=True,
    )
    return [tokenize_ipa(item) for item in completed.stdout.split() if item.strip()]


def phonemize_text(text: str, language: str = 'en-us') -> tuple[str, list[dict]]:
    raw_words = [word for word in text.split() if normalize_word(word)]
    espeak_words = espeak_ipa_words(text, language)
    ipa_words = []
    words = []

    for idx, raw_word in enumerate(raw_words):
        word = normalize_word(raw_word)
        ph = espeak_words[idx] if idx < len(espeak_words) and espeak_words[idx] else PHONEME_MAP.get(word, list(word))
        words.append({'word': word, 'phonemes': ph})
        ipa_words.append(''.join(ph))

    return ' '.join(ipa_words), words
