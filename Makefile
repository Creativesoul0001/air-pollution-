SHELL := /bin/bash
.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up down build logs ps restart dev backend frontend pipeline seed os-seed \
        test test-backend test-frontend lint format typecheck api-types \
        build-ml train docker-build ci cd

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ---------- Local dev ----------
up: ## Start full stack (detached)
	$(COMPOSE) up -d

dev: ## Start full stack (foreground)
	$(COMPOSE) up

down: ## Stop and remove containers
	$(COMPOSE) down

build: ## Build/rebuild images
	$(COMPOSE) build

logs: ## Tail all logs
	$(COMPOSE) logs -f --tail=100

ps: ## Show service status
	$(COMPOSE) ps

restart: down up ## Restart stack

backend: ## Open a shell in the backend service
	$(COMPOSE) exec backend bash

frontend: ## Open a shell in the frontend service
	$(COMPOSE) exec frontend sh

pipeline: ## Force-run one ingestion pass inside the worker
	$(COMPOSE) exec pipeline-worker python -m app.pipeline.run_once

seed: ## Seed DynamoDB + LocalStack fixtures
	docker compose exec backend python -m app.core.seed

os-seed: ## Re-run the OpenSearch source seeder
	docker compose restart opensearch-seed

## ---------- Quality ----------
test: ## Run all tests (backend + frontend unit)
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend: ## Run pytest with coverage
	docker compose exec -e ENV=test backend pytest -q --cov=app --cov-report=term-missing

test-frontend: ## Run frontend unit tests
	docker compose exec frontend npm run test:unit

lint: ## Lint backend + frontend
	docker compose exec backend ruff check .
	docker compose exec frontend npm run lint

format: ## Auto-format backend + frontend
	docker compose exec backend ruff format .
	docker compose exec frontend npm run format

typecheck: ## Type-check backend + frontend
	docker compose exec backend mypy app
	docker compose exec frontend npm run typecheck

api-types: ## Regenerate frontend types from OpenAPI schema
	docker compose exec backend python -m app.openapi_dump > /app/openapi.json
	docker compose exec frontend npx openapi-typescript /app/openapi.json -o src/lib/types.ts

## ---------- ML ----------
build-ml: ## Build the ML image
	docker build -t dhuan-ml ./ml

train: ## Train the PM2.5 model (LOSO) inside ML image
	docker run --rm -v "$$(pwd)/ml:/app" dhuan-ml python src/train.py --loso --output models/pm25_xgb

## ---------- CI ----------
ci: lint typecheck test ## Run the same gates CI runs

cd: ## Deploy to AWS (requires AWS creds)
	cd backend && sam build --use-container && sam deploy --no-confirm-changeset
