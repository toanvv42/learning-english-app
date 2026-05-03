PYTHON ?= python3.11
PRONUNCIATION_DIR := services/pronunciation-api
PRONUNCIATION_VENV := $(PRONUNCIATION_DIR)/.venv
PRONUNCIATION_PYTHON := $(PRONUNCIATION_VENV)/bin/python
PRONUNCIATION_UVICORN := $(PRONUNCIATION_VENV)/bin/uvicorn

.PHONY: pronunciation-venv pronunciation-dev pronunciation-test pronunciation-health supabase-push

pronunciation-venv:
	cd $(PRONUNCIATION_DIR) && $(PYTHON) -m venv .venv
	$(PRONUNCIATION_PYTHON) -m pip install -r $(PRONUNCIATION_DIR)/requirements.txt

pronunciation-dev: pronunciation-venv
	cd $(PRONUNCIATION_DIR) && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pronunciation-test: pronunciation-venv
	cd $(PRONUNCIATION_DIR) && .venv/bin/python -m pytest

pronunciation-health:
	curl -sS http://127.0.0.1:8000/health

supabase-push:
	supabase db push
