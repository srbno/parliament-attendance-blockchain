# Blockchain

Esta pasta está reservada para a **Fase 2** do projeto.

Na Fase 2, deverá conter a implementação local Ethereum, incluindo:

- smart contract `AttendanceRegistry`;
- configuração Foundry;
- scripts de deploy;
- testes de contrato;
- documentação de execução com Anvil/Forge.

O backend já está preparado para esta evolução através da interface `BlockchainService`. A implementação futura deverá substituir o `HardhatBlockchainService` por um adaptador Ethereum sem alterar a lógica principal de validação, geração de evidência, hashing ou assinatura.


## BlockChain Architecture Overview

The intent of our project is to store attendance records in a way that allows us to check if the data has been somehow tampered with in our internal records.

Therefore, we don't want to store internal data directly into the blockchain, since - even in a private chain there's still a risk of data leakeage.

However, we still want to find a way to prove that our internal data hasn't been tampered with.
One way to achieve this, we need to store only a representation of the internal data that can be retrieved later to validate original records.

A common approach to achieve this is through hashing, where an algorithm transforms the existing data into a deterministic value.

### Hashing Strategy
The structure to be stored in the database should be the one that follows:

```
export type RegisterAttendanceProofInput = {
  recordId: string;
  deputyId: string;
  sessionId: string;
  registeredAt: string;
  validationPolicyId: string;
  evidenceHash: string;
  signature: string;
};
```

- recordId
    - blockchain unique record of the attendance
- deputyId
    - Internal identifier of the congressman
- sessionId
    - Internal identifier of the session
- registeredAt
    - Date of the registration
- validationPolicyId
    - Internal identifier of the validation policy
- evidenceHash
    - There is an exhaustive attendance check performed in the code before the attendance record gets stored in the database and then in the chain, so this field is the result of the validation performed, meant to assert that the aforementioned code was indeed executed and had its result value stored in this parameter
    - The value of this has is based off in the following structure:
        - recordId: record.id.toString(),
        - deputyId: record.deputyId.toString(),
        - sessionId: record.sessionId.toString(),
        - registeredAt: record.registeredAt.toISOString(),
        - validationPolicyId,
        - validationResult
- signature
    - Signature used for signing the evidenceHash

### Hashing Algorithm
The strategy for hashing combines canonicalization + Keccak-256 hashing

**Canonicalization**
- Sort the keys of the object by key name
- Convert the object to a JSON string
  This computes the cryptographic hash.

**Keccak-256 is:**
- Ethereum’s native hash algorithm
- close to SHA-3
- deterministic
- one-way
- collision-resistant

### Improvements to be made in the blockhain record
Currently, we are storing one attendance record per blockchain record. However, to optimize the gas cost, we could store all records of a session using merkle tree with individual hashes. 