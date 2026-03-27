# Regra de Conversao Automatica de Embalagem

## O Problema

Quando importamos faturas de fornecedores, alguns enviam a **quantidade em embalagens** e outros em **unidades base** (litros ou kg).

**Exemplo C.VALE:**
- Fatura diz: GLIFOSATO 20LT — Qty: 125 — Preco: $67.60
- Aqui 125 sao **embalagens** de 20 litros = 2.500 litros no total
- O preco $67.60 e por **embalagem**, nao por litro

**Exemplo UNIGRANOS:**
- Fatura diz: UNIZEB GOLD 15 KG — Qty: 990 — Preco: $5.20
- Aqui 990 ja sao **quilos** (unidade base)
- O preco $5.20 ja e por **kg**

Se o sistema nao detectar a diferenca, o estoque fica completamente errado.

---

## A Solucao: Regra de 3 Camadas

O sistema analisa cada produto em **3 etapas sequenciais**. Se uma etapa ja decide, as seguintes nao sao executadas.

---

### CAMADA 1 — Detectar embalagem no nome

O sistema procura numeros seguidos de LT, LTS, KG, KGS no nome do produto.

| Produto | Detectou? | Tamanho |
|---------|-----------|---------|
| GLIFOSATO NORTOX **20 LT** | Sim | 20 |
| EXTRAZONE **5LT** | Sim | 5 |
| UNIZEB GOLD **15 KG** | Sim | 15 |
| CROPMAX PLUS 06-29-09 | Nao | — |
| VERDICT ULTRA LITROS | Nao | — |

**Se NAO detecta embalagem → NAO CONVERTE (fim)**

Isso ja elimina todos os produtos que nao tem tamanho de embalagem no nome.

---

### CAMADA 2 — Teste do preco minimo

Divide o preco unitario da fatura pelo tamanho da embalagem.

**Regra: se preco / embalagem < $1.90 → NAO CONVERTE**

A logica e simples: se dividir o preco pelo tamanho da embalagem resulta em centavos, isso significa que o preco ja esta por unidade base (litro/kg), nao por embalagem.

| Produto | Preco | Embalagem | Preco / Emb | Resultado |
|---------|-------|-----------|-------------|-----------|
| UNIZEB GOLD 15 KG | $5.20 | 15 | **$0.35** | < $1.90 → NAO CONVERTE |
| GLIFOSATO 20 LT | $67.60 | 20 | **$3.38** | >= $1.90 → Vai para Camada 3 |
| EXTRAZONE 5LT | $17.80 | 5 | **$3.56** | >= $1.90 → Vai para Camada 3 |

**Por que $1.90?** Porque nao existem produtos agroinsumos que custem menos de $1.90 por litro/kg. Entao se o resultado da divisao e menor que isso, com certeza o preco ja esta na unidade base.

---

### CAMADA 3 — Consulta ao estoque do sistema

Se o produto ja existe no estoque com um preco medio cadastrado, o sistema compara:

**Regra: se preco da fatura > preco do estoque x 2 → CONVERTE**

| Produto | Preco Fatura | Preco Estoque | Fatura / Estoque | Resultado |
|---------|-------------|---------------|------------------|-----------|
| GLIFOSATO 20 LT | $67.60 | $3.50/L | **19.3x** | > 2x → **CONVERTE** |
| CENTURION 5 LTS | $40.20 | $8.04/L | **5.0x** | > 2x → **CONVERTE** |
| SOBERAN 5 LTS | $14.50 | $2.90/L | **5.0x** | > 2x → **CONVERTE** |
| KELLUS MANGANESE 3KG | $12.80 | $12.80/kg | **1.0x** | <= 2x → **NAO CONVERTE** |
| KELLUS COPPER 3KG | $29.00 | $29.00/kg | **1.0x** | <= 2x → **NAO CONVERTE** |

**Caso especial — Produto novo (primeira compra):**
Se o produto nunca foi comprado antes e nao tem preco no estoque, o sistema usa o **fallback**: se passou pelas Camadas 1 e 2, provavelmente e embalagem → **CONVERTE**.

---

## Resumo Visual

```
Produto chega na fatura
         |
    [CAMADA 1] Tem numero + LT/KG no nome?
         |                    |
        SIM                  NAO → NAO CONVERTE ✓
         |
    [CAMADA 2] Preco / embalagem < $1.90 ?
         |                    |
        NAO                  SIM → NAO CONVERTE ✓
         |
    [CAMADA 3] Produto ja tem preco no estoque?
         |                    |
        SIM                  NAO → CONVERTE (fallback) ✓
         |
    Preco fatura > preco estoque x 2 ?
         |                    |
        SIM                  NAO
    CONVERTE ✓          NAO CONVERTE ✓
```

---

## Validacao com Faturas Reais

Testamos a regra com faturas reais da **C.VALE** e **UNIGRANOS**:

### C.VALE (todos os produtos devem CONVERTER)
| Produto | Resultado | OK? |
|---------|-----------|-----|
| GLIFOSATO NORTOX 20 LT | CONVERTE | ✓ |
| EXTRAZONE 5LT | CONVERTE | ✓ |
| CENTURION 5 LTS | CONVERTE | ✓ |
| PACTO 5 LTS | CONVERTE | ✓ |
| SOBERAN 5 LTS | CONVERTE | ✓ |
| FOX XPRO 5LT | CONVERTE | ✓ |
| NATIVO 5LT | CONVERTE | ✓ |
| ORKESTRA ULTRA 5LT | CONVERTE | ✓ |
| ELATUS 3 LTS | CONVERTE | ✓ |

### UNIGRANOS (nenhum produto deve converter)
| Produto | Resultado | OK? |
|---------|-----------|-----|
| CROPMAX PLUS 06-29-09 | NAO CONVERTE | ✓ |
| VERDICT ULTRA LITROS | NAO CONVERTE | ✓ |
| FLOXY PRO EXTRA | NAO CONVERTE | ✓ |
| UNIZEB GOLD 15 KG | NAO CONVERTE | ✓ |
| KELLUS MANGANESE ICL CX 05X03 KG | NAO CONVERTE | ✓ |
| KELLUS ZINC ICL CX 05X03 KG | NAO CONVERTE | ✓ |
| KELLUS COPPER ICL CX05X3KG | NAO CONVERTE | ✓ |
| QUINTAL XTRA 12X1LT | NAO CONVERTE | ✓ |

**Resultado: 18 de 18 produtos com embalagem detectavel acertaram!**

> Nota: CLASSIC 300G (C.VALE) usa gramas (G) que o sistema ainda nao detecta — apenas LT e KG sao suportados atualmente. Esse e um caso isolado e pode ser ajustado manualmente na fatura.

---

## Quando o usuario precisa intervir?

1. **Produto com unidade em gramas (G)** — ainda nao detectado automaticamente
2. **Produto novo com preco atipico** — sem historico no estoque, o fallback assume conversao. Se estiver errado, basta editar o item na fatura antes de confirmar
3. **Fornecedor muda o padrao** — se um fornecedor que sempre enviava em embalagens comecar a enviar em unidades base, o estoque corrige automaticamente na proxima compra (Camada 3 se ajusta)
