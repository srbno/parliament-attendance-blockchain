# Sistema de Controlo de Assiduidade Parlamentar

Backend API desenvolvido no âmbito da cadeira de **Blockchain** do **Mestrado em Engenharia Informática do ISCTE**.

O projeto implementa uma prova de conceito para registo de assiduidade parlamentar com validação contextual, geração de evidência criptográfica determinística e integração com blockchain Hardhat local.

A integração blockchain está isolada atrás de uma interface `BlockchainService`, permitindo substituir o adaptador Hardhat por um adaptador Ethereum sem alterar a lógica de validação ou geração de evidência.

## Âmbito

Inclui:

- API HTTP com Fastify, TypeScript e validação Zod.
- Autenticação por `username` e `password`, com JWT.
- Hashing de passwords com Argon2.
- PostgreSQL com Prisma ORM.
- Gestão de deputados, sessões parlamentares e localizações autorizadas.
- Registo de assiduidade por deputados autenticados.
- Validação de IP autorizado por CIDR IPv4.
- Validação de coordenadas GPS por raio autorizado.
- Validação de precisão GPS.
- Validação da janela temporal de check-in.
- Prevenção de duplicados e replay através de `clientRequestId`.
- Geração de JSON canónico determinístico.
- Geração de `evidenceHash` com Keccak-256 sobre o payload de evidência completo (incluindo seed).
- Submissão do `evidenceHash` ao smart contract `AttendanceRegistry` via Hardhat local.
- Verificação on-chain: recuperação do hash registado pelo `txHash` e comparação com o hash recalculado.
- Auditoria de eventos relevantes.

O fluxo de assiduidade aceite termina com estado `SUBMITTED`, não `CONFIRMED`.

## Fora Do Âmbito

Não está implementado:

- Submissão a uma rede Ethereum pública.
- Confirmação automática de bloco (estado `CONFIRMED`).
- Testes de contrato Foundry.
- Carteiras ou chaves privadas individuais dos deputados.
- Swagger/OpenAPI.
- Microserviços, CQRS, event sourcing, Redis ou message brokers.

## Arquitectura

O backend segue um monólito modular simples:

```text
Route
  -> validação de request
  -> service
  -> validation engine
  -> evidence/hash service
  -> repository/database
  -> blockchain service abstraction
```

A lógica de assiduidade não depende de uma implementação concreta de blockchain. A interface `BlockchainService` permite substituir o adaptador Hardhat por um adaptador Ethereum sem alterar a validação ou a geração de evidência.

## Stack Técnica

- Node.js 24 LTS
- pnpm 10
- TypeScript
- Fastify
- PostgreSQL
- Prisma ORM
- Zod
- `@fastify/jwt`
- Argon2
- Vitest
- Keccak-256 através do pacote `@noble/hashes`

## Pré-Requisitos

- Node.js 24 LTS
- pnpm 10
- Docker com o daemon ativo, para PostgreSQL local

## Configuração Inicial

Instalar dependências:

```bash
pnpm install
```

Criar ficheiro de ambiente:

```bash
cp .env.example .env
```

Antes de correr a aplicação, substituir no `.env`:

- `JWT_SECRET`
- `EVIDENCE_HASH_SEED` — gerar com `openssl rand -hex 32`

Os valores no `.env.example` são placeholders intencionalmente inválidos. Devem ser substituídos por segredos gerados fora do Git antes de iniciar a aplicação.

**Nota:** `EVIDENCE_HASH_SEED` é tratado como imutável durante o ciclo de vida do sistema. Alterar este valor após registos existentes invalida a verificação on-chain de todos os registos anteriores.

## Base De Dados

Subir PostgreSQL:

```bash
docker compose up -d postgres
```

Aplicar migrações:

```bash
pnpm prisma migrate dev
```

Popular dados iniciais:

```bash
pnpm seed
```

O seed cria:

- um utilizador `admin`;
- um utilizador `auditor`;
- um utilizador `deputy`;
- um deputado ativo;
- uma localização autorizada;
- uma sessão parlamentar aberta;
- a política ativa `POLICY_V1`.

Password local dos utilizadores de demonstração:

```text
ChangeMe123!
```

Esta password é apenas para desenvolvimento local.

## Execução

Correr a API em modo de desenvolvimento:

```bash
pnpm dev
```

URL local por omissão:

```text
http://127.0.0.1:3000
```

Compilar:

```bash
pnpm build
```

## Testes

Testes unitários:

```bash
pnpm test
```

Testes de integração:

```bash
pnpm test:integration
```

Os testes de integração requerem PostgreSQL a correr e a base de dados migrada.

Cobertura:

```bash
pnpm test:coverage
```

## Testes Manuais Com Bruno

O repositório inclui uma coleção para o HTTP Client Bruno em:

```text
bruno/
```

Para usar:

1. Abrir o Bruno.
2. Escolher `Open Collection`.
3. Selecionar a pasta `bruno`.
4. Escolher o ambiente `Local`.
5. Garantir que a API está a correr em `http://127.0.0.1:3000`.

Fluxo recomendado:

1. Executar `Auth / Login - Deputy` para guardar `accessToken`.
2. Executar `Auth / Me` para confirmar o token.
3. Executar `Attendance / Submit Attendance`.
4. Executar `Attendance / Verify Attendance`.

Para endpoints administrativos, executar primeiro `Auth / Login - Admin`. Para consultas de auditoria, executar `Auth / Login - Auditor`.

Nota: `clientRequestId` é usado para proteção contra replay. Para repetir `Attendance / Submit Attendance`, alterar `clientRequestId` no ambiente `Local`.

## Exemplos De API

Login:

```bash
curl -s http://127.0.0.1:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"deputy","password":"ChangeMe123!"}'
```

Submeter assiduidade:

```bash
curl -s http://127.0.0.1:3000/attendance/submit \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{
    "sessionId": "1",
    "gps": {
      "latitude": 38.714,
      "longitude": -9.152,
      "accuracyMeters": 20
    },
    "clientRequestId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Verificar evidência local:

```bash
curl -s http://127.0.0.1:3000/attendance/1/verify \
  -H "authorization: Bearer $TOKEN"
```

A verificação recalcula o `evidenceHash` a partir do payload armazenado e compara com o hash recuperado on-chain via `txHash`. Devolve `overallResult` com um dos valores: `CHAIN_VALID`, `CHAIN_VERIFICATION_FAILED` ou `LOCAL_VERIFICATION_FAILED`.

## Integração Blockchain

O serviço `HardhatBlockchainService` envia transações reais ao nó Hardhat local. A interface `BlockchainService` expõe dois métodos:

- `registerAttendanceProof({ recordId, evidenceHash })` — submete `addRecord(recordId, evidenceHash)` ao contrato e devolve `{ submitted, txHash, blockNumber }`.
- `getOnChainHashForTx(txHash)` — recupera a transação pelo hash, descodifica o calldata de `addRecord` e devolve `{ recordId, hash }`.

Para usar a integração local:

1. Iniciar o nó Hardhat na pasta `blockchain/`:

```bash
cd blockchain
npx hardhat node
```

2. Fazer deploy do contrato (em separado):

```bash
npx hardhat run scripts/deploy.js --network localhost
```

3. Definir `BLOCKCHAIN_CONTRACT_ADDRESS` no `.env` com o endereço devolvido pelo deploy.

Em modo `BLOCKCHAIN_MODE=mock` (padrão para testes), as transações não são enviadas e `txHash` é um valor gerado localmente.

## Evolução Futura

Para migrar para uma rede Ethereum pública, implementar um novo adaptador que implemente `BlockchainService` e apontar para o nó pretendido. A validação, geração de evidência e hashing não precisam de ser alterados.

## Segurança E Gestão De Dependências

As dependências são fixadas com versões exactas em `package.json`; não são usados intervalos com `^` ou `~`.

O projeto usa `pnpm-lock.yaml` para garantir instalações reprodutíveis. A configuração em `.npmrc` inclui:

```ini
save-exact=true
package-lock=false
lockfile=true
strict-peer-dependencies=true
auto-install-peers=false
store-dir=.pnpm-store
```

Scripts de ciclo de vida de dependências são tratados como risco de supply chain. Apenas são permitidos explicitamente:

- `argon2`, necessário para hashing seguro de passwords;
- `@prisma/engines` e `prisma`, necessários para Prisma;
- `esbuild`, necessário por ferramentas de desenvolvimento e testes.

Para rever scripts bloqueados ou ignorados:

```bash
pnpm ignored-builds
```

Não devem ser aprovados novos scripts sem justificar a necessidade da dependência.

## Segredos

Segredos devem vir sempre de variáveis de ambiente:

- `DATABASE_URL`
- `JWT_SECRET`
- `EVIDENCE_HASH_SEED`

O repositório deve conter apenas `.env.example`. Não devem ser commitados:

- `.env`;
- JWT secrets;
- tokens;
- passwords;
- headers `Authorization`;
- credenciais de produção.

`EVIDENCE_HASH_SEED` é incluído no payload canónico antes do hash. Não é enviado ao cliente nem guardado na base de dados.

## Logs E Erros

Os logs estruturados não devem incluir passwords, hashes de passwords, JWTs, chaves privadas ou headers de autorização.

As respostas de erro seguem um formato estável:

```json
{
  "error": {
    "code": "GPS_OUT_OF_RANGE",
    "message": "The reported location is outside the authorized radius for this session.",
    "details": {}
  }
}
```

Stack traces e detalhes internos não devem ser expostos nas respostas da API.

## Minimização De Dependências

Foram evitadas dependências desnecessárias. Em particular:

- não há NestJS ou Express;
- não há TypeORM ou Sequelize;
- não há Redis;
- não há message broker;
- não há biblioteca geográfica externa.

O cálculo de distância usa Haversine implementado localmente. A validação de CIDR IPv4 também é implementada localmente. A integração blockchain usa `ethers` (já dependência transitiva do Hardhat).
