# Fluxo de Assiduidade, Evidência e Blockchain

Este documento explica como o backend prepara uma presença para submissão blockchain, quais dados guarda, quais dados envia para a camada blockchain e como verificar a consistência entre banco, assinatura e blockchain.

## 1. Como funciona o fluxo de submit?

O fluxo principal está em `AttendanceService.submit`, em `backend/src/modules/attendance/attendance.service.ts`. O método funciona como orquestrador:

```text
getDataRequiredToValidateAttendance
  -> validateAttendanceSubmission
  -> rejectInvalidAttendanceSubmission
  -> createPendingAttendanceRecord
  -> createSignedAttendanceEvidence
  -> submitAttendanceProofToBlockchain
  -> markAttendanceProofSubmitted
  -> auditAttendanceProofSubmitted
  -> toSubmitAttendanceResponse
```

Primeiro, `getDataRequiredToValidateAttendance` recolhe os dados necessários: utilizador autenticado, deputado associado, sessão, localização, política ativa `POLICY_V1`, IP normalizado, data/hora atual, duplicados e replay por `clientRequestId`.

Depois, `validateAttendanceSubmission` chama `runPolicyV1`, em `backend/src/modules/validation/policies/policy-v1.ts`. Essa função decide se a presença é válida de acordo com autenticação, deputado ativo, sessão aberta, janela temporal, IP, GPS, precisão e replay.

Se a validação falhar, `rejectInvalidAttendanceSubmission` grava um `AuditLog` com `eventType: attendance_validation_rejected` e lança `AppError`.

Se a validação passar, `createPendingAttendanceRecord` cria um `AttendanceRecord` com `status: PENDING`. Em seguida, `createSignedAttendanceEvidence` monta a evidência, calcula `evidenceHash` e assina esse hash com a chave privada da aplicação.

A chave privada entra em `EvidenceService`, em `backend/src/modules/evidence/evidence.service.ts`, que cria `SignerService` com `env.APP_PRIVATE_KEY`. A assinatura acontece em:

```ts
signEvidenceHash(evidenceHash)
```

que delega para `SignerService.signHash`, em `backend/src/modules/evidence/signer.service.ts`.

Por fim, `submitAttendanceProofToBlockchain` chama `BlockchainService.registerAttendanceProof`. Hoje a implementação é `HardhatBlockchainService`, mas a interface é a mesma que será usada por um adaptador blockchain real.

## 2. Quais dados salvamos no banco? Porquê?

O modelo principal é `AttendanceRecord`, definido em `backend/prisma/schema.prisma`.

Campos principais:

```prisma
id
deputyId
sessionId
registeredAt
clientRequestId
clientIp
gpsLatitude
gpsLongitude
gpsAccuracyMeters
validationPolicyId
validationDetailsJson
evidencePayloadJson
evidenceHash
signature
txHash
blockNumber
status
failureReason
```

O banco guarda os dados completos porque ele é a fonte operacional da aplicação. Precisamos saber quem marcou presença, em que sessão, quando, com que IP/GPS, qual política foi aplicada e qual foi o resultado da validação.

`validationDetailsJson` guarda o resultado detalhado de `runPolicyV1`. Isto permite auditar por que motivo a presença foi aceite ou rejeitada.

`evidencePayloadJson` guarda o payload completo usado para gerar o hash. Ele é necessário para recalcular `evidenceHash` mais tarde e detectar alterações.

`evidenceHash` é a impressão digital da evidência. Se qualquer campo do payload mudar, o hash recalculado deixa de bater.

`signature` prova que a aplicação assinou aquele `evidenceHash` usando a chave privada interna.

`txHash` e `blockNumber` ligam o registo local à blockchain. `txHash` identifica a transação enviada; `blockNumber` identifica o bloco onde a transação foi confirmada, quando isso existir.

## 3. Quais dados vão para a blockchain? Porquê?

A interface blockchain está em `backend/src/modules/blockchain/blockchain.service.ts`, no tipo `RegisterAttendanceProofInput`:

```ts
{
  recordId: string;
  deputyId: string;
  sessionId: string;
  registeredAt: string;
  validationPolicyId: string;
  evidenceHash: string;
  signature: string;
}
```

Esses dados são enviados por `submitAttendanceProofToBlockchain`, em `AttendanceService`.

A blockchain não precisa receber o payload completo com IP, GPS e todos os detalhes de validação. O banco guarda esses dados. A blockchain deve guardar uma prova curta e verificável.

O campo mais importante é `evidenceHash`, porque ele representa o conteúdo completo da evidência guardada no banco. A `signature` acompanha o hash para provar que a aplicação reconheceu aquela evidência.

Os IDs e metadados (`recordId`, `deputyId`, `sessionId`, `registeredAt`, `validationPolicyId`) ajudam a indexar e consultar a prova on-chain sem armazenar dados sensíveis ou volumosos.

Hoje, `HardhatBlockchainService` em `backend/src/modules/blockchain/hardhat-blockchain.service.ts` simula a submissão e devolve:

```ts
{
  submitted: true,
  txHash,
  blockNumber: null
}
```

No futuro, um adaptador real deve implementar a mesma interface.

## 4. Qual algoritmo de hash usamos e porquê?

O algoritmo está em `HashService`, em `backend/src/modules/evidence/hash.service.ts`:

```ts
readonly algorithm = 'keccak256';
```

O método principal é:

```ts
hashCanonical(value)
```

Ele primeiro canonicaliza o JSON e depois aplica Keccak-256.

A canonicalização está em `backend/src/modules/evidence/canonical-json.ts`. Ela normaliza datas, números, `bigint`, arrays e objetos, ordenando chaves para garantir que os mesmos dados geram sempre a mesma string antes do hash.

Isto evita que dois objetos semanticamente iguais gerem hashes diferentes apenas porque as chaves vieram em outra ordem.

Usamos Keccak-256 porque é o algoritmo historicamente associado ao ecossistema Ethereum. Assim, a prova fica alinhada com a futura integração blockchain.

## 5. Como checamos banco versus blockchain? Como entra a chave privada?

Hoje, `AttendanceService.verify` faz a verificação local:

```text
1. Busca AttendanceRecord no banco.
2. Recalcula evidenceHash a partir de evidencePayloadJson.
3. Compara com evidenceHash salvo no banco.
4. Verifica se signature é válida para evidenceHash.
5. Confirma se o status local é SUBMITTED.
```

No código, isto aparece em:

```ts
this.evidenceService.hashEvidencePayload(...)
this.evidenceService.verifySignature(...)
```

em `backend/src/modules/attendance/attendance.service.ts`.

A chave privada é usada apenas no submit, para assinar:

```text
signature = sign(evidenceHash, APP_PRIVATE_KEY)
```

Na verificação, conceitualmente usamos a chave pública correspondente. O código atual deriva a public key dentro de `SignerService` a partir de `APP_PRIVATE_KEY`, mas o papel criptográfico é este:

```text
private key: assina
public key: verifica
```

Quando houver blockchain real, o `verify` deve ser expandido:

```text
1. Recalcular evidenceHash a partir do banco.
2. Verificar signature contra evidenceHash.
3. Consultar a blockchain por txHash ou recordId.
4. Ler o evidenceHash registado on-chain.
5. Comparar evidenceHash do banco com evidenceHash da blockchain.
6. Confirmar txHash/blockNumber quando a transação estiver confirmada.
```

Se o hash recalculado, a assinatura e o hash on-chain baterem, então o registo local está consistente com a prova registada na blockchain.

Em resumo:

```text
Banco guarda os dados completos.
Hash resume esses dados.
Private key assina o hash.
Blockchain ancora o hash assinado.
Verify recalcula e compara tudo.
```
