HOST ?= 0.0.0.0
PORT ?= 8000

.PHONY: bootstrap dev render-build render-start lint test check ai-node ai-python

bootstrap:
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
	npm run lint

test:
	npm test

check: lint test

ai-node:
	npm run ai:check

ai-python:
	uv run python -c "from analytics.config import settings; print(f'AI runtime: {settings.ai_runtime}, model: {settings.openai_model}')"
