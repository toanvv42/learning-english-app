from app.models.phoneme_model import PhonemeModel


def load_models() -> dict:
    return {'phoneme_model': PhonemeModel(), 'aligner': object()}
