class PhonemeModel:
    loaded: bool = True

    def infer(self, audio_path: str):
        return [
            {'phoneme': 'h', 'start': 0.0, 'end': 0.1},
            {'phoneme': 'ɛ', 'start': 0.1, 'end': 0.2},
            {'phoneme': 'l', 'start': 0.2, 'end': 0.3},
            {'phoneme': 'oʊ', 'start': 0.3, 'end': 0.5},
        ]
