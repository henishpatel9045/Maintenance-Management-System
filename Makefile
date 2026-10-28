.PHONY: up down logs build dev migrate seed backup restore test lint security smoke ci

# Default target
all: build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

build:
	npm run build

dev:
	docker compose -f docker-compose.dev.yml up

migrate:
	docker compose exec -T app npx prisma db push

seed:
	docker compose exec -T app npx tsx prisma/seed.ts

reset-password:
	docker compose exec app npx tsx scripts/reset-password.ts $(filter-out $@,$(MAKECMDGOALS))

backup:
	bash scripts/backup.sh

restore:
	bash scripts/restore.sh $(filter-out $@,$(MAKECMDGOALS))

test:
	npm run test

lint:
	npm run lint

security:
	npm run test:security

smoke:
	bash scripts/smoke-test.sh

ci: lint security test build
