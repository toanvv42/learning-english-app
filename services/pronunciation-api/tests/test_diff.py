from app.utils.diff import diff_phonemes


def test_diff_low_cost_mapping():
    score, errors = diff_phonemes(['θ'], ['t'])
    assert score == 50
    assert errors[0]['tip']


def test_diff_always_returns_tip():
    _, errors = diff_phonemes(['k'], ['t'])
    assert isinstance(errors[0]['tip'], str)
    assert errors[0]['tip']
