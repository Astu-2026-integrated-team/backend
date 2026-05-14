HOST ?= 0.0.0.0
PORT ?= 8000

.PHONY: bootstrap dev render-build render-start lint lint-python lint-node test test-python test-node check check-python check-node ai-node ai-python

bootstrap:
	uv sync --all-groups
	npm ci
	npm run prisma:generate

dev:
	npm run dev

render-build:
	npm ci
	npm run prisma:generate

render-start:
	npm start

lint:
	$(MAKE) lint-python
	$(MAKE) lint-node

lint-python:
	uv run ruff check .

lint-node:
	npm run lint:node

test:
	$(MAKE) test-python
	$(MAKE) test-node

test-python:
	uv run pytest

test-node:
	npm run test:node

check-python: lint-python test-python

check-node: lint-node test-node

check: check-python check-node

ai-node:
	npm run ai:check

ai-python:
	uv run python -c "from analytics.config import settings; print(f'AI runtime: {settings.ai_runtime}, model: {settings.openai_model}')"
