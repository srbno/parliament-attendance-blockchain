# Blockchain

Esta pasta contém o smart contract `AttendanceRegistry`, a configuração Hardhat e o script de deploy.

## Estrutura

```text
blockchain/
├── contracts/
│   └── AttendanceRegistry.sol
├── scripts/
│   └── deploy.js
├── hardhat.config.ts
└── package.json
```

## Smart Contract

`AttendanceRegistry` regista pares `(recordId, evidenceHash)` imutáveis na blockchain.

```solidity
function addRecord(uint256 _id, bytes32 _hash) external
function getRecord(uint256 index) external view returns (Record memory)
function getTotalRecords() external view returns (uint256)
```

O contrato não armazena dados pessoais. Apenas o `evidenceHash` (comprometimento criptográfico do payload de evidência) é registado on-chain.

## Execução Local

Iniciar nó Hardhat:

```bash
cd blockchain
npm install
npx hardhat node
```

Deploy do contrato (em janela separada):

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Copiar o endereço devolvido para `BLOCKCHAIN_CONTRACT_ADDRESS` no `.env` do backend.

## Integração Com O Backend

O backend usa `HardhatBlockchainService` para comunicar com o contrato:

- **Submit:** chama `addRecord(recordId, evidenceHash)` e guarda o `txHash` resultante.
- **Verify:** `getSubmittedRecordFromTx(txHash)` recupera a transação, descodifica o calldata de `addRecord` com `ethers.Interface` e devolve `{ recordId, hash }`. O backend reconstrói o payload a partir das colunas do banco, recalcula o hash e compara com o hash devolvido.

### Payload de Evidência

O `evidenceHash` enviado ao contrato é `keccak256` de `EVIDENCE_HASH_SEED + canonicalize(payload)`, onde o payload é:

```json
{
  "recordId": "...",
  "deputyId": "...",
  "sessionId": "...",
  "registeredAt": "...",
  "validationPolicyId": "POLICY_V1",
  "validationResult": { ... },
  "applicationId": "...",
  "applicationVersion": "...",
  "hashAlgorithm": "keccak256"
}
```

`EVIDENCE_HASH_SEED` é carregado da variável de ambiente e nunca guardado na base de dados. É prefixado como string ao JSON canónico antes do hash, tornando o resultado computacionalmente imprevisível para quem não conheça o seed.

**Aviso:** alterar `EVIDENCE_HASH_SEED` invalida a verificação on-chain de todos os registos existentes, porque o hash recalculado divergirá do hash armazenado no contrato.

### Interface Do Serviço Blockchain

```typescript
export type RegisterAttendanceProofInput = {
  recordId: string;
  evidenceHash: string;
};

export type OnChainAttendanceRecord = {
  recordId: string;
  hash: string;
};

export interface BlockchainService {
  registerAttendanceProof(input: RegisterAttendanceProofInput): Promise<{
    submitted: boolean;
    txHash: string | null;
    blockNumber: number | null;
    reason?: string;
  }>;
  getSubmittedRecordFromTx(txHash: string): Promise<OnChainAttendanceRecord | null>;
}
```

## Estratégia de Hashing

**Canonicalização + Keccak-256:**

1. Ordenar as chaves do payload por nome.
2. Serializar para JSON determinístico.
3. Calcular `keccak256` sobre os bytes UTF-8 resultantes.

**Keccak-256** é o algoritmo nativo do Ethereum: determinístico, unidirecional e resistente a colisões. A adição do `seed` converte o hash num comprometimento ocultante (*hiding commitment*), impedindo que um observador externo verifique a presença de um deputado por tentativa e erro.

## Melhorias Possíveis

- Substituir o array `Record[]` por um `mapping(uint256 => bytes32)` para acesso O(1) por `recordId`.
- Emitir um evento `RecordAdded(uint256 indexed id, bytes32 hash)` para facilitar indexação off-chain.
- Usar Merkle tree para agregar registos de uma sessão numa única transação e reduzir custos de gas.
