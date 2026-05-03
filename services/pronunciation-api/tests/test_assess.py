from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'


def test_phonemes_validation():
    r = client.post('/phonemes', json={'text': ''})
    assert r.status_code == 400


def test_phonemes_requires_api_key_when_configured(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post('/phonemes', json={'text': 'hello'})

    assert r.status_code == 401
    assert r.json()['detail']['code'] == 'unauthorized'


def test_phonemes_rejects_wrong_api_key(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post(
        '/phonemes',
        headers={'Authorization': 'Bearer wrong-secret'},
        json={'text': 'hello'},
    )

    assert r.status_code == 401


def test_phonemes_accepts_correct_api_key(monkeypatch):
    monkeypatch.setenv('PRONUNCIATION_API_KEY', 'test-secret')

    r = client.post(
        '/phonemes',
        headers={'Authorization': 'Bearer test-secret'},
        json={'text': 'hello'},
    )

    assert r.status_code == 200
    assert r.json()['words'][0]['word'] == 'hello'
