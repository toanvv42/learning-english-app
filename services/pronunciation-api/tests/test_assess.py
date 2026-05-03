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
