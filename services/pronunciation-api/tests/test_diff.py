from app.utils.diff import diff_phonemes


def test_diff_low_cost_mapping():
    score, errors = diff_phonemes(['θ'], ['t'])
    assert score == 50
    assert errors[0]['tip']
