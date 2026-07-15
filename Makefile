.PHONY: up down logs migrate seed test lint build check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec -T database psql -U kokusei -d kokusei -f /docker-entrypoint-initdb.d/01_init.sql

seed:
	docker compose exec -T database psql -U kokusei -d kokusei -f /docker-entrypoint-initdb.d/02_development_seed.sql

test:
	cd backend && go test ./...
	cd frontend && npm test

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

build:
	cd backend && go build ./cmd/api
	cd frontend && npm run build

check: lint test build
