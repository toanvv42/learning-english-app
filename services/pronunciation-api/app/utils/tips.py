TIP_MAP = {
    ('θ', 't'): "Place your tongue between your teeth for the 'th' sound",
    ('θ', 'd'): "Place your tongue between your teeth for the 'th' sound",
    ('ð', 'd'): "Voiced 'th' — tongue between teeth, vibrate your vocal cords",
    ('ð', 'z'): "Voiced 'th' — tongue between teeth, vibrate your vocal cords",
    ('æ', 'ɛ'): 'Open your mouth wider, drop your tongue lower',
    ('æ', 'a'): 'Open your mouth wider, drop your tongue lower',
    ('ɹ', 'r'): "English 'r' — pull tongue back, no trill or tap",
    ('z', 's'): 'Add voicing — your throat should vibrate',
    ('v', 'b'): 'Lower lip touches upper teeth, then add voice',
    ('v', 'f'): 'Lower lip touches upper teeth, then add voice',
    ('ʃ', 's'): 'Round your lips, pull tongue back from teeth',
    ('tʃ', 't'): 'Stop the air completely, then release with friction',
    ('tʃ', 'ʃ'): 'Stop the air completely, then release with friction',
}


def get_tip(expected: str, actual: str) -> str:
    if not actual:
        return "Don't swallow the final consonant — release it clearly"
    return TIP_MAP.get((expected, actual), 'Listen to the target sound and repeat it slowly')
