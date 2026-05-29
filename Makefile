ROOT := $(shell pwd)
PIDS := $(ROOT)/.pids
LOGS := $(ROOT)/logs

.PHONY: dev stop setup seed migrate db status logs

## Start all services for local development
dev: db
	@echo "[hardhat] Starting Hardhat node..."
	@cd blockchain && npx hardhat node >> $(LOGS)/hardhat.log 2>&1 & echo $$! > $(PIDS)/hardhat.pid
	@echo "[backend] Starting Fastify backend..."
	@cd backend && pnpm dev >> $(LOGS)/backend.log 2>&1 & echo $$! > $(PIDS)/backend.pid
	@echo "[frontend] Starting Nuxt frontend..."
	@cd frontend && pnpm dev >> $(LOGS)/frontend.log 2>&1 & echo $$! > $(PIDS)/frontend.pid
	@echo ""
	@echo "All services started."
	@echo "  DB:         localhost:5432"
	@echo "  Hardhat:    localhost:8545   (logs/hardhat.log)"
	@echo "  Backend:    http://localhost:3001   (logs/backend.log)"
	@echo "  Frontend:   http://localhost:3000   (logs/frontend.log)"
	@echo ""
	@echo "Run 'make logs' to follow all logs."
	@echo "Run 'make stop' to stop all services."

## Start PostgreSQL only
db:
	@echo "[db] Starting PostgreSQL..."
	@docker compose -f backend/docker-compose.yml up -d
	@echo "[db] Waiting for PostgreSQL to be ready..."
	@until docker compose -f backend/docker-compose.yml exec -T postgres pg_isready -U attendance -q; do sleep 1; done
	@echo "[db] PostgreSQL is ready."

## Stop all background services
stop:
	@for svc in hardhat backend frontend; do \
		if [ -f $(PIDS)/$$svc.pid ]; then \
			pid=$$(cat $(PIDS)/$$svc.pid); \
			if kill -0 $$pid 2>/dev/null; then \
				kill $$pid && echo "[stop] Stopped $$svc (pid $$pid)"; \
			else \
				echo "[stop] $$svc already stopped"; \
			fi; \
			rm -f $(PIDS)/$$svc.pid; \
		fi; \
	done
	@docker compose -f backend/docker-compose.yml stop
	@echo "[stop] Done."

## Install all dependencies (run once after cloning)
setup:
	@echo "[setup] Installing backend deps..."
	@cd backend && pnpm install
	@echo "[setup] Installing blockchain deps..."
	@cd blockchain && npm install
	@echo "[setup] Installing frontend deps..."
	@cd frontend && pnpm install
	@echo "[setup] Done. Copy backend/.env.example to backend/.env and fill in secrets."

## Apply Prisma migrations (run once when the database is first created)
migrate: db
	@echo "[migrate] Applying Prisma migrations..."
	@cd backend && pnpm prisma migrate deploy
	@echo "[migrate] Done."

## Seed the database with demo data
seed:
	@cd backend && pnpm seed

## Show status of background services
status:
	@echo "Service    PID       Status"
	@echo "---------- --------- -------"
	@for svc in hardhat backend frontend; do \
		if [ -f $(PIDS)/$$svc.pid ]; then \
			pid=$$(cat $(PIDS)/$$svc.pid); \
			if kill -0 $$pid 2>/dev/null; then \
				printf "%-10s %-9s %s\n" $$svc $$pid "running"; \
			else \
				printf "%-10s %-9s %s\n" $$svc $$pid "dead (stale pid)"; \
			fi; \
		else \
			printf "%-10s %-9s %s\n" $$svc "-" "stopped"; \
		fi; \
	done

## Tail all service logs
logs:
	@tail -f $(LOGS)/hardhat.log $(LOGS)/backend.log $(LOGS)/frontend.log
