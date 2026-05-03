from app.services.phonemizer import phonemize_text


def test_phonemize_text():
    ipa, words = phonemize_text('hello world')
    assert 'h' in ipa
    assert words[0]['word'] == 'hello'
