# Sistema de Controlo de Assiduidade Parlamentar com Blockchain

Monorepo desenvolvido no âmbito da cadeira de **Blockchain** do **Mestrado em Engenharia Informática do ISCTE**.

O projeto implementa uma prova de conceito para controlo de assiduidade parlamentar com backend API, validação contextual, evidência criptográfica e preparação para integração blockchain.

## Estrutura

```text
.
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── tests/
│   ├── bruno/
│   └── README.md
├── blockchain/
│   └── README.md
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## Componentes

- `backend/`: API Fastify em TypeScript. Implementa a Fase 1: autenticação, gestão de deputados/sessões/localizações, validação de assiduidade, geração de hashes, assinatura interna e mock blockchain.
- `blockchain/`: espaço reservado para a Fase 2. Deve conter o smart contract, scripts de deploy e testes Foundry quando a integração Ethereum local for implementada.

## Fase Atual

A Fase 1 está implementada no backend. Nesta fase, a aplicação termina registos aceites em `READY_FOR_CHAIN` e usa `MockBlockchainService`.

Ainda não está implementado:

- smart contract;
- Foundry, Forge ou Anvil;
- submissão real para Ethereum;
- consulta on-chain;
- `viem`.

## Pré-Requisitos

- Node.js 24 LTS
- pnpm 10
- Docker com daemon ativo, para PostgreSQL local

## Instalação

Na raiz do monorepo:

```bash
pnpm install
```

Criar o ambiente do backend:

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` e substituir `JWT_SECRET` e `APP_PRIVATE_KEY` por valores reais gerados fora do Git.

## Base De Dados

Subir PostgreSQL a partir da raiz do monorepo:

```bash
docker compose up -d postgres
```

Aplicar migrações:

```bash
pnpm --dir backend prisma migrate dev
```

Popular dados iniciais:

```bash
pnpm seed
```

## Execução

Executar o backend a partir da raiz:

```bash
pnpm dev
```

URL local por omissão:

```text
http://127.0.0.1:3000
```

## Testes

```bash
pnpm test
pnpm test:coverage
```

Testes de integração:

```bash
pnpm test:integration
```

Os testes de integração exigem PostgreSQL a correr e a base de dados migrada.

## Testes Manuais

A coleção Bruno está em:

```text
backend/bruno/
```

Abrir essa pasta no Bruno, escolher o ambiente `Local` e executar primeiro um dos pedidos de login.

## Documentação

- Backend: `backend/README.md`
- Blockchain futura: `blockchain/README.md`
