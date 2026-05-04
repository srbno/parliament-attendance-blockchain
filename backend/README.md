# Sistema de Controlo de Assiduidade Parlamentar

Backend API desenvolvido no âmbito da cadeira de **Blockchain** do **Mestrado em Engenharia Informática do ISCTE**.

O projeto implementa a **Fase 1** de uma prova de conceito para registo de assiduidade parlamentar com validação contextual, geração de evidência criptográfica determinística, assinatura interna da aplicação e preparação para integração futura com blockchain.

Nesta fase, **não há submissão real para Ethereum**. A integração blockchain está isolada atrás de uma interface e é representada por um serviço mock.

## Âmbito Da Fase 1

Esta fase inclui:

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
- Geração de `validationResultHash` e `evidenceHash` com Keccak-256.
- Assinatura de `evidenceHash` com chave privada interna da aplicação.
- Verificação local de hashes e assinatura.
- Auditoria de eventos relevantes.
- `MockBlockchainService`, que indica explicitamente que a blockchain ainda não está implementada.

O fluxo de assiduidade aceite termina com estado `READY_FOR_CHAIN`, não `CONFIRMED`.

## Fora Do Âmbito Da Fase 1

Não está implementado nesta fase:

- Smart contract.
- Foundry, Forge ou Anvil.
- Submissão real de transações Ethereum.
- Consulta real à blockchain.
- `viem`.
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
  -> evidence/hash/signing service
  -> repository/database
  -> blockchain service abstraction
```

A lógica de assiduidade não depende de uma implementação concreta de blockchain. A interface `BlockchainService` permite substituir o mock por um adaptador Ethereum numa fase posterior sem alterar a validação, a geração de evidência ou a assinatura.

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
- Keccak-256 e secp256k1 através de pacotes `@noble`

## Pré-Requisitos

- Node.js 24 LTS
- pnpm 10
- Docker com o daemon ativo, para PostgreSQL local

## Configuração Inicial

Instalar dependências a partir da raiz do monorepo:

```bash
cd ..
pnpm install
```

Criar ficheiro de ambiente para o backend:

```bash
cp backend/.env.example backend/.env
```

Antes de correr a aplicação, substituir no `.env`:

- `JWT_SECRET`
- `APP_PRIVATE_KEY`

Os valores de `JWT_SECRET` e `APP_PRIVATE_KEY` no `.env.example` são placeholders intencionalmente inválidos. Devem ser substituídos por segredos gerados fora do Git antes de iniciar a aplicação.

## Base De Dados

Subir PostgreSQL:

```bash
docker compose up -d postgres
```

Aplicar migrações:

```bash
pnpm --dir backend prisma migrate dev
```

Popular dados iniciais:

```bash
pnpm --dir backend seed
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
pnpm --dir backend dev
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

Na Fase 1, a verificação confirma apenas a consistência local entre base de dados, payload canónico, hashes e assinatura. Não declara validade on-chain.

## Mock Blockchain

O serviço `MockBlockchainService` devolve sempre:

```json
{
  "submitted": false,
  "txHash": null,
  "blockNumber": null,
  "reason": "Blockchain integration not implemented yet"
}
```

Isto é intencional. A Fase 1 prepara os dados que serão submetidos na Fase 2, mas não envia transações reais.

## Notas Para A Fase 2

Na Fase 2, o mock deverá ser substituído por um adaptador Ethereum que implemente a mesma interface `BlockchainService`.

O fluxo previsto é:

1. Submeter a prova ao smart contract `AttendanceRegistry`.
2. Guardar `txHash`.
3. Mudar o estado do registo para `SUBMITTED`.
4. Aguardar o recibo da transação.
5. Mudar o estado para `CONFIRMED` em caso de sucesso.
6. Guardar `blockNumber`.
7. Em caso de falha, mudar para `FAILED` e guardar `failureReason`.
8. Expandir o endpoint de verificação para consultar também a blockchain.

A validação, geração de evidência, hashing e assinatura não devem precisar de ser reescritas.

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
- `APP_PRIVATE_KEY`

O repositório deve conter apenas `.env.example`. Não devem ser commitados:

- `.env`;
- chaves privadas reais;
- JWT secrets;
- tokens;
- passwords;
- headers `Authorization`;
- credenciais de produção.

`APP_PRIVATE_KEY` é usada apenas pelo `SignerService`. Não é enviada ao cliente nem guardada na base de dados.

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
- não há biblioteca geográfica externa;
- não há biblioteca blockchain na Fase 1.

O cálculo de distância usa Haversine implementado localmente. A validação de CIDR IPv4 também é implementada localmente.
