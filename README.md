# Sistema de Controlo de Assiduidade Parlamentar com Blockchain

Projeto desenvolvido no âmbito da cadeira de **Blockchain** do **Mestrado em Engenharia Informática do ISCTE**.

## Estrutura

```text
.
├── Makefile
├── backend/          # API Fastify (TypeScript)
├── blockchain/       # Smart contract (Solidity + Hardhat)
├── frontend/         # Aplicação de auditoria (Nuxt 3)
└── docs/
```

## Componentes

- **backend/** — API Fastify em TypeScript. Autenticação JWT, gestão de deputados/sessões/localizações, validação de assiduidade por política, geração de evidência criptográfica (Keccak-256), submissão à blockchain Hardhat e verificação on-chain via `txHash`.
- **blockchain/** — Smart contract `AttendanceRegistry` em Solidity, configuração Hardhat e script de deploy.
- **frontend/** — Aplicação de auditoria em Nuxt 3 para o papel AUDITOR. Permite consultar sessões, deputados e registos de presença, e verificar a integridade dos registos na blockchain.

---

## Pré-requisitos

- Node.js 24+
- pnpm 11+
- Docker + Docker Compose
- `pg_isready` disponível dentro do container PostgreSQL (incluído na imagem `postgres:18-alpine`)

---

## Primeiro arranque (instalação completa)

Seguir estes passos pela ordem indicada.

### 1. Instalar dependências

```bash
make setup
```

Instala as dependências do backend, blockchain e frontend.

### 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` e preencher os valores obrigatórios:

| Variável | Descrição |
|---|---|
| `JWT_SECRET` | Segredo para assinar tokens JWT (gerar com `openssl rand -hex 32`) |
| `EVIDENCE_HASH_SEED` | Seed de 64 hex chars para o hash de evidência (gerar com `openssl rand -hex 32`) |
| `BLOCKCHAIN_MODE` | `mock` para testes locais sem Hardhat; `hardhat` para blockchain real |

Os restantes valores por omissão funcionam para desenvolvimento local.

### 3. Aplicar migrações da base de dados

> **Obrigatório na primeira vez.** Cria as tabelas no PostgreSQL.

```bash
docker compose -f backend/docker-compose.yml up -d
cd backend && pnpm prisma migrate dev
```

### 4. Popular dados de demonstração

```bash
make seed
```

Cria os utilizadores de demo:

| Username | Password | Papel |
|---|---|---|
| `admin` | `ChangeMe123!` | ADMIN |
| `auditor` | `ChangeMe123!` | AUDITOR |
| `deputy` | `ChangeMe123!` | DEPUTY |

### 5. Arrancar todos os serviços

```bash
make dev
```

Inicia PostgreSQL, Hardhat, backend e frontend em background.

| Serviço | URL |
|---|---|
| Frontend (auditoria) | http://localhost:3000 |
| Backend (API) | http://localhost:3001 |
| Hardhat (blockchain local) | http://localhost:8545 |
| PostgreSQL | localhost:5432 |

---

## Arranque rápido (após primeira instalação)

```bash
make dev
```

---

## Comandos Makefile

```bash
make dev      # Inicia todos os serviços
make stop     # Para todos os serviços
make status   # Mostra estado de cada serviço
make logs     # Segue logs de todos os serviços em tempo real
make seed     # Popula a base de dados com dados de demo
make setup    # Instala todas as dependências
make db       # Inicia apenas o PostgreSQL
```

Logs individuais em `logs/backend.log`, `logs/frontend.log`, `logs/hardhat.log`.

---

## Testes

A partir de `backend/`:

```bash
pnpm test                                      # Testes unitários
pnpm test:coverage                             # Cobertura
RUN_INTEGRATION_TESTS=1 pnpm test:integration  # Requer PostgreSQL a correr
```

## Testes Manuais (Bruno)

A coleção Bruno está em `backend/bruno/`. Abrir no Bruno, escolher o ambiente `Local` e executar primeiro um pedido de login para obter o token.

---

## Modos de Blockchain

| Modo | Descrição |
|---|---|
| `BLOCKCHAIN_MODE=mock` | Gera `txHash` local sem RPC. Verificação funciona apenas enquanto o backend não reiniciar. |
| `BLOCKCHAIN_MODE=hardhat` | Submete transações reais ao nó Hardhat local. Verificação on-chain persiste. |

Para usar o modo `hardhat`, o nó e o contrato têm de estar a correr (`make dev` já inclui o Hardhat).
