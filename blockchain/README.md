# Blockchain

Esta pasta está reservada para a **Fase 2** do projeto.

Na Fase 2, deverá conter a implementação local Ethereum, incluindo:

- smart contract `AttendanceRegistry`;
- configuração Foundry;
- scripts de deploy;
- testes de contrato;
- documentação de execução com Anvil/Forge.

O backend já está preparado para esta evolução através da interface `BlockchainService`. A implementação futura deverá substituir o `HardhatBlockchainService` por um adaptador Ethereum sem alterar a lógica principal de validação, geração de evidência, hashing ou assinatura.
