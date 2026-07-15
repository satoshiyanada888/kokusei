.PHONY: up down logs lan-url migrate seed fetch-population test test-integration lint build check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

lan-url:
	@IP=$$(ipconfig getifaddr en0); test -n "$$IP" && echo "http://$$IP:3000"

migrate:
	docker compose exec -T database psql -U kokusei -d kokusei -f /docker-entrypoint-initdb.d/01_init.sql
	docker compose exec -T database psql -U kokusei -d kokusei -f /docker-entrypoint-initdb.d/02_provenance.sql

seed:
	docker compose exec -T database psql -U kokusei -d kokusei -f /docker-entrypoint-initdb.d/03_development_seed.sql

fetch-population:
	docker compose --profile tools run --rm --build population-import

test:
	cd backend && go test ./...
	cd frontend && npm test

test-integration:
	docker run --rm --network stateofjapan_default -e TEST_DATABASE_URL=postgres://kokusei:kokusei@database:5432/kokusei?sslmode=disable -v "$(CURDIR)/backend:/app" -w /app golang:1.23-alpine go test -tags=integration ./internal/repository/postgres

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

build:
	cd backend && go build ./cmd/api
	cd backend && go build ./cmd/import-population
	cd frontend && npm run build

check: lint test build
