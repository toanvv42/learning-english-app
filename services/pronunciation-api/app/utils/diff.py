from app.utils.tips import get_tip

LOW_COST = {
    ('θ', 't'), ('θ', 'd'), ('ð', 'd'), ('ð', 'z'), ('æ', 'ɛ'), ('æ', 'a'),
    ('ɹ', 'r'), ('z', 's'), ('v', 'b'), ('v', 'f'), ('ʃ', 's'), ('tʃ', 't'), ('tʃ', 'ʃ')
}


def substitution_cost(a: str, b: str) -> float:
    if a == b:
        return 0.0
    return 0.5 if (a, b) in LOW_COST else 1.0


def diff_phonemes(expected: list[str], actual: list[str]) -> tuple[int, list[dict]]:
    errors = []
    max_len = max(len(expected), len(actual), 1)
    total_cost = 0.0
    for i in range(max_len):
        e = expected[i] if i < len(expected) else ''
        a = actual[i] if i < len(actual) else ''
        if e != a:
            c = substitution_cost(e, a)
            total_cost += c
            errors.append({'position': i, 'expected': e, 'actual': a, 'tip': get_tip(e, a)})
    score = max(0, int(round(100 * (1 - total_cost / max_len))))
    return score, errors
