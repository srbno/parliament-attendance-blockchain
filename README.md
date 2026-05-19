# Sistema de Controlo de Assiduidade Parlamentar com Blockchain

Projeto desenvolvido no âmbito da cadeira de **Blockchain** do **Mestrado em Engenharia Informática do ISCTE**.

O repositório está organizado por componentes, mas sem workspace `pnpm` na raiz nesta fase. O backend é executado de forma autónoma a partir da pasta `backend/`; a pasta `blockchain/` fica reservada para a implementação da Fase 2.

## Estrutura

```text
.
├── README.md
├── docs/
├── backend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── docker-compose.yml
│   ├── src/
│   ├── prisma/
│   ├── tests/
│   ├── bruno/
│   └── README.md
└── blockchain/
    └── README.md
```

## Componentes

- `backend/`: API Fastify em TypeScript. Implementa autenticação, gestão de deputados/sessões/localizações, validação de assiduidade, geração de evidência criptográfica, submissão à blockchain Hardhat local e verificação on-chain via `txHash`.
- `blockchain/`: smart contract `AttendanceRegistry` em Solidity, configuração Hardhat e script de deploy.
- `docs/`: documentação auxiliar do projeto.

## Estado Atual

O projeto integra backend e blockchain local:

- Smart contract `AttendanceRegistry` em `blockchain/contracts/`.
- Hardhat configurado em `blockchain/`.
- Backend submete `evidenceHash` ao contrato via `addRecord(recordId, evidenceHash)` e guarda `txHash`.
- Verificação on-chain: o backend recupera os dados da transação pelo `txHash` e compara o hash on-chain com o hash recalculado a partir do payload armazenado.

Ainda fora do âmbito:

- submissão a uma rede Ethereum pública;
- confirmação automática de bloco (estado `CONFIRMED`);
- testes de contrato Foundry.

## Execução Do Backend

Entrar na pasta do backend:

```bash
cd backend
```

Instalar dependências:

```bash
pnpm install
```

Criar o ficheiro de ambiente:

```bash
cp .env.example .env
```

Editar `.env` e substituir `JWT_SECRET` e `EVIDENCE_HASH_SEED` por valores reais gerados fora do Git.

Subir PostgreSQL:

```bash
docker compose up -d postgres
```

Aplicar migrações e popular dados iniciais:

```bash
pnpm prisma migrate dev
pnpm seed
```

Executar a API:

```bash
pnpm dev
```

URL local por omissão:

```text
http://127.0.0.1:3000
```

## Testes

A partir de `backend/`:

```bash
pnpm test
pnpm test:coverage
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
