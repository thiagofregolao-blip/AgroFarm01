# Roteiro de Teste - Sprint 32 - AgroFarmDigital

## Instrucoes para o Agente Testador

Voce e um **contador profissional** contratado para auditar e testar o sistema financeiro completo do aplicativo AgroFarmDigital. Voce tem experiencia em contabilidade rural, contas a pagar/receber, fluxo de caixa e gestao de estoque agricola.

Seu trabalho e testar TODAS as funcionalidades listadas abaixo como se fosse um usuario real do sistema. Para cada teste voce deve:
- Executar a acao descrita passo a passo
- Verificar se o resultado esperado aconteceu
- Verificar efeitos colaterais (ex: ao pagar uma conta, verificar se o saldo da conta bancaria diminuiu)
- Anotar TUDO: o que passou, o que falhou, e qualquer comportamento estranho

**IMPORTANTE**: Nao apenas clique nos botoes - VERIFIQUE os dados. Um contador confere numeros. Se voce lancou uma despesa de $5.000, va no fluxo de caixa e confirme que apareceu $5.000 la. Se voce pagou uma conta, volte na conta bancaria e veja se o saldo abaixou.

**URL do sistema**: Use a URL de producao do Railway ou localhost conforme disponivel.
**Credenciais**: Use as credenciais de teste fornecidas (usuario tipo fazendeiro/agricultor).

---

## PRE-REQUISITOS

Antes de iniciar os testes, verifique que voce tem:
- [ ] Pelo menos 1 propriedade cadastrada
- [ ] Pelo menos 1 safra ativa
- [ ] Pelo menos 1 conta bancaria no Fluxo de Caixa
- [ ] Pelo menos 3 fornecedores cadastrados
- [ ] Pelo menos 1 fatura importada (status pendente)
- [ ] Pelo menos 2 produtos no estoque
- [ ] Pelo menos 1 barracão/deposito cadastrado

Se algum pre-requisito nao existir, crie-o antes de iniciar os testes.

---

## BLOCO A - FORNECEDORES (Itens #2, #3, #16)

### Teste A1 - Tipo de Pessoa e Entidade
1. Acesse o menu **Fazenda > Fornecedores**
2. Clique em **Novo Fornecedor**
3. Preencha: Nome "Fornecedor Teste A1", Telefone "099999999"
4. Selecione **Tipo**: Provedor
5. Selecione **Entidade**: Fisica
6. Salve
7. **Verificar**: O fornecedor aparece na lista com badges "Provedor" e "Fisica"?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste A2 - Tipo Cliente/Juridica
1. Crie outro fornecedor: "Empresa Teste A2"
2. Selecione **Tipo**: Cliente
3. Selecione **Entidade**: Juridica
4. Preencha RUC: "80012345-6"
5. Salve
6. **Verificar**: Aparece com badges "Cliente" e "Juridica"?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste A3 - Validacao RUC Duplicado
1. Tente criar outro fornecedor com o MESMO RUC "80012345-6"
2. **Verificar**: O sistema bloqueia e mostra mensagem de RUC duplicado?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO B - FATURAS (Itens #5, #6, #8, #9, #12, #13, #15, #31, #32)

### Teste B1 - Importar Fatura via WhatsApp (se disponivel)
1. Acesse **Faturas > Faturas**
2. Se tiver uma fatura importada via WhatsApp, verifique:
   - A moeda foi detectada corretamente (USD/PYG)?
   - O fornecedor foi registrado automaticamente?
   - A safra foi vinculada automaticamente (se ha safra com periodo de pagamento ativo)?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B2 - Deletar Fatura
1. Selecione uma fatura de teste (nao uma real)
2. Clique em deletar/remover
3. **Verificar**: A fatura foi removida sem erro de FK constraint?
4. **Verificar**: Os itens da fatura tambem foram removidos?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B3 - Aprovar Fatura com "Somente Valor" (Skip Stock)
1. Selecione uma fatura pendente
2. Ao aprovar, marque a opcao **"Somente valor (nao dar entrada no estoque)"**
3. Confirme a aprovacao
4. **Verificar**: A fatura foi aprovada mas o estoque NAO aumentou?
5. Va em **Estoque** e confirme que as quantidades nao mudaram para os produtos dessa fatura
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B4 - Aprovar Fatura com Deposito Destino
1. Selecione outra fatura pendente
2. Ao aprovar, selecione um **deposito/barracão destino**
3. Confirme a aprovacao
4. **Verificar**: O estoque aumentou no deposito selecionado?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B5 - Editar Fatura Apos Aprovacao
1. Selecione uma fatura ja aprovada
2. Tente editar algum campo (fornecedor, observacao)
3. **Verificar**: A edicao e possivel e salva corretamente?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B6 - Vinculacao Automatica de Safra
1. Verifique se ha uma safra com **periodo de pagamento** configurado (data inicio e fim de pagamento)
2. Importe ou crie uma fatura com data dentro desse periodo
3. **Verificar**: A safra foi vinculada automaticamente a fatura?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B7 - Filtros de Busca na Lista de Faturas
1. Acesse **Faturas > aba Faturas**
2. **Verificar**: Existem campos de filtro (busca por fornecedor, numero da fatura, data)?
3. Digite o nome de um fornecedor no campo de busca
4. **Verificar**: A lista filtra mostrando so faturas desse fornecedor?
5. Filtre por numero de fatura
6. **Verificar**: Funciona corretamente?
7. Filtre por periodo de data
8. **Verificar**: So aparecem faturas do periodo?
9. Limpe os filtros
10. **Verificar**: Todas as faturas voltam a aparecer?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste B8 - Bot de Precos (Produtos Manuais no Estoque)
1. Se o bot WhatsApp esta disponivel, envie uma consulta de preco para um produto que foi cadastrado MANUALMENTE no estoque (nao importado via fatura)
2. **Verificar**: O bot retorna o preco do produto manual?
3. Se o bot nao esta disponivel, verifique via API: `GET /api/farm/webhook/n8n/prices?product=NOME_PRODUTO`
4. **Verificar**: O endpoint retorna resultados incluindo produtos do `farm_stock` (nao apenas do historico de faturas)?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___
- [ ] NAO TESTAVEL (bot indisponivel e sem acesso a API)

### Teste B9 - Simbolo de Moeda na Despesa Vinculada
1. Tenha uma fatura importada com moeda detectada (ex: PYG ou USD)
2. Abra o modal **Nova Despesa**
3. Marque **"Despesa com fatura"** e selecione essa fatura
4. **Verificar**: O simbolo da moeda da fatura aparece no campo de valor ou no resumo?
5. **Verificar**: O valor e exibido na moeda correta da fatura?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO C - DESPESAS (Itens #7, Modal Nova Despesa)

### Teste C1 - Lancar Despesa A Vista COM Conta Bancaria
1. Acesse **Faturas** (menu principal)
2. Clique no botao **"Nova Despesa"** no topo da pagina
3. Preencha:
   - Categoria: Diesel/Combustivel
   - Fornecedor: Clique na lupa e busque um fornecedor existente
   - Valor: 5000
   - Data: hoje
   - Descricao: "Teste C1 - Diesel"
   - Pagamento: A Vista
   - Selecione uma **Conta para debito**
   - Propriedade: selecione uma
   - Safra: selecione uma
4. Clique **Lancar Despesa**
5. **Verificar**: Despesa criada com sucesso (toast verde)?
6. Va na aba **"Despesas s/ Fatura"** e confirme que a despesa aparece na tabela
7. **CRITICO - Va em Contas a Pagar**: Confirme que foi criada uma entrada com status "Pago"
8. **CRITICO - Va em Fluxo de Caixa > Extrato**: Confirme que apareceu uma saida de $5.000
9. **CRITICO - Va em Fluxo de Caixa > Contas**: Confirme que o saldo da conta diminuiu $5.000
- [ ] PASSOU (todos os 4 pontos criticos OK)
- [ ] FALHOU - Motivo: ___

### Teste C2 - Lancar Despesa A Prazo
1. Abra **Nova Despesa** novamente
2. Preencha:
   - Categoria: Arrendamento
   - Fornecedor: busque um fornecedor
   - Valor: 12000
   - Pagamento: **A Prazo**
   - N Parcelas: 3
   - 1o Vencimento: proximo mes
3. Clique **Lancar Despesa**
4. **Verificar**: Despesa criada com sucesso?
5. **CRITICO - Va em Contas a Pagar > aba Contas**: Confirme que existem TRES entradas (parcela 1/3, 2/3, 3/3) de $4.000 cada
6. **Verificar**: Cada parcela tem a data de vencimento correta (mensal)?
7. **Verificar**: O Fluxo de Caixa NAO deve ter nenhuma movimentacao (pois e a prazo)
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste C3 - Lancar Despesa COM Fatura
1. Abra **Nova Despesa**
2. Marque o checkbox **"Despesa com fatura"**
3. Selecione uma fatura pendente da lista
4. Preencha os demais campos
5. Clique **Lancar Despesa**
6. **Verificar**: A despesa foi criada e NAO aparece na aba "Despesas s/ Fatura" (pois tem fatura vinculada)
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste C4 - Modal de Busca de Fornecedor
1. Ao lancar despesa, clique no campo **Fornecedor** (icone de lupa)
2. **Verificar**: Abre um modal de busca?
3. Digite parte do nome de um fornecedor
4. **Verificar**: A lista filtra em tempo real?
5. **Verificar**: Mostra badges de tipo (provedor/cliente) e entidade (fisica/juridica)?
6. Selecione um fornecedor
7. **Verificar**: O nome foi preenchido no formulario?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste C5 - Formato do Modal Nova Despesa
1. Abra o modal Nova Despesa
2. **Verificar**: O layout e horizontal (campos lado a lado, nao empilhados)?
3. **Verificar**: Categoria, Fornecedor e Descricao estao na mesma linha?
4. **Verificar**: Valor, Data, Pagamento, Propriedade e Safra estao na mesma linha?
5. **Verificar**: Os botoes "Cancelar" e "Lancar Despesa" estao fixos no rodape?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste C6 - Tabela Despesas s/ Fatura
1. Va na aba **Despesas s/ Fatura**
2. **Verificar**: Os dados estao em formato de TABELA (nao cards)?
3. **Verificar**: Colunas presentes: Data | Fornecedor | Categoria | Pagamento | Vencimento | Parcelas | Status | Valor?
4. **Verificar**: Para despesas "A Prazo", a coluna Vencimento mostra a data e Parcelas mostra "0/3" etc?
5. **Verificar**: Para despesas "A Vista", Vencimento e Parcelas mostram "--"?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO D - CONTAS A PAGAR (Itens #22, #23, #26)

### Teste D1 - Aba Contas - Filtros
1. Acesse **Financeiro > Contas a Pagar**
2. Na aba **Contas**, teste os filtros:
   - Filtre por Status "Aberto" - so aparecem contas abertas?
   - Filtre por Fornecedor especifico - so aparecem contas dele?
   - Filtre por periodo de vencimento - funciona?
   - Filtre por Safra - funciona?
   - Clique "Limpar" - todos voltam?
3. **Verificar**: O contador "X de Y registros" atualiza corretamente?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D2 - Aba Contas - Editar
1. Selecione uma conta aberta
2. Clique **Editar**
3. Altere o fornecedor ou valor
4. Salve
5. **Verificar**: Os dados foram atualizados na tabela?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D3 - Aba Pagamento - Novo Formato
1. Clique na aba **Pagamento**
2. **Verificar**: NAO existe mais o dropdown "Selecione o Fornecedor"
3. **Verificar**: Aparece uma tabela com TODAS as contas pendentes
4. **Verificar**: Cada linha tem um checkbox
5. **Verificar**: Ha filtros no topo: busca por texto, data, safra
6. **Verificar**: Ha um botao "Realizar Pagamento" (desabilitado)
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D4 - Aba Pagamento - Selecao e Pagamento
1. Na aba Pagamento, marque 2 contas usando os checkboxes
2. **Verificar**: O botao "Realizar Pagamento" habilitou?
3. **Verificar**: Aparece barra de resumo com total selecionado?
4. Clique **Realizar Pagamento**
5. **Verificar**: Abre um modal horizontal com:
   - Resumo das contas selecionadas
   - Campo para selecionar conta bancaria
   - Campo de valor (pre-preenchido)
   - Metodo de pagamento
   - Botoes "Cancelar" e "Confirmar Pagamento" no rodape
6. Selecione uma conta bancaria
7. Clique **Confirmar Pagamento**
8. **Verificar**: Toast de sucesso?
9. **CRITICO - Volte na aba Contas**: As 2 contas agora tem status "Pago"?
10. **CRITICO - Va em Fluxo de Caixa**: Apareceram 2 saidas correspondentes?
11. **CRITICO - Verifique o saldo da conta**: Diminuiu o valor correto?
- [ ] PASSOU (todos os 3 pontos criticos OK)
- [ ] FALHOU - Motivo: ___

### Teste D5 - Aba Pagamento - Filtro de Busca
1. Na aba Pagamento, digite o nome de um fornecedor no campo de busca
2. **Verificar**: A tabela filtra mostrando so contas desse fornecedor?
3. Limpe a busca
4. Filtre por data de vencimento
5. **Verificar**: So aparecem contas no periodo selecionado?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D6 - Aba Pagamento - Selecao em Massa
1. Clique no checkbox do cabecalho da tabela (selecionar todos)
2. **Verificar**: Todos os itens foram marcados?
3. Clique novamente
4. **Verificar**: Todos desmarcaram?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D7 - Aba Historico
1. Clique na aba **Historico**
2. **Verificar**: Aparece uma tabela com pagamentos realizados?
3. **Verificar**: Colunas: Data Pgto | Fornecedor | Descricao | Parcela | Valor Pago?
4. Use o campo de busca para filtrar
5. **Verificar**: Filtra corretamente?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste D8 - Botao "Nova Conta" Removido
1. Na tela de Contas a Pagar
2. **Verificar**: NAO existe mais o botao "Nova Conta" (contas sao criadas automaticamente via despesas/faturas)
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO E - CONTAS A RECEBER (Itens #18, #19, #20, #24)

### Teste E1 - Campo Fornecedor/Cliente
1. Acesse **Financeiro > Contas a Receber**
2. **Verificar**: Ha um campo de fornecedor/cliente nas contas?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste E2 - Editar Conta a Receber
1. Selecione uma conta a receber existente
2. Clique no botao **Editar**
3. Altere algum campo (valor, descricao)
4. Salve
5. **Verificar**: As alteracoes foram salvas?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste E3 - Aba Recebimento
1. **Verificar**: Existe uma aba "Recebimento" (similar a aba Pagamento do AP)?
2. **Verificar**: Funciona de forma similar ao fluxo de pagamento?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO F - FLUXO DE CAIXA (Itens #21, #27, #28)

### Teste F1 - Botao "Novo Lancamento" Removido
1. Acesse **Financeiro > Fluxo de Caixa**
2. **Verificar**: NAO existe mais o botao "Novo Lancamento" (lancamentos vem automaticamente de pagamentos/recebimentos)
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste F2 - Cards de Resumo Expandiveis
1. Na tela de Fluxo de Caixa, veja os cards de resumo (Entradas, Saidas, Saldo)
2. Clique em um card
3. **Verificar**: O card expande mostrando detalhes das transacoes?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste F3 - Filtro de Data no Extrato
1. Va na aba **Extrato**
2. **Verificar**: Existem campos de data (de/ate) para filtrar?
3. Selecione um periodo
4. **Verificar**: O extrato filtra mostrando so transacoes do periodo?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste F4 - Transferencia entre Contas
1. Va na aba **Transferencias**
2. Crie uma transferencia:
   - Conta Origem: selecione uma com saldo
   - Conta Destino: selecione outra
   - Valor: 1000
   - Data: hoje
3. Confirme
4. **CRITICO - Verifique conta origem**: Saldo diminuiu $1.000?
5. **CRITICO - Verifique conta destino**: Saldo aumentou $1.000?
6. **Verificar**: A transferencia aparece no historico da aba?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste F5 - Editar Transferencia
1. Na aba Transferencias, encontre a transferencia criada
2. Clique em editar
3. Altere a data
4. **Verificar**: A data foi atualizada?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO G - ESTOQUE (Item #14)

### Teste G1 - Transferencia entre Depositos
1. Acesse **Estoque**
2. Va na aba **Transferencias**
3. Preencha:
   - Produto: selecione um com estoque
   - Deposito Origem: selecione o que tem estoque
   - Deposito Destino: selecione outro
   - Quantidade: 10
4. Confirme a transferencia
5. **CRITICO - Verifique deposito origem**: A quantidade diminuiu 10?
6. **CRITICO - Verifique deposito destino**: A quantidade aumentou 10?
7. **Verificar**: A transferencia aparece no historico?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO H - NOVOS MODULOS (Itens #4, #29, #30)

### Teste H1 - Codeudor/Pagare (Garantias)
1. Acesse a secao de **Garantias/Codeudor** (se disponivel no menu)
2. Cadastre um codeudor com dados de teste
3. **Verificar**: O codeudor foi salvo e aparece na lista?
4. Delete o codeudor
5. **Verificar**: Foi removido?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___
- [ ] NAO ENCONTRADO NO MENU - Motivo: ___

### Teste H2 - Emissao de Fatura (Invoice Issuance)
1. Acesse a secao de **Faturas Emitidas** (se disponivel)
2. Crie uma fatura emitida com dados de teste
3. **CRITICO - Va em Contas a Receber**: Foi criada automaticamente uma entrada?
4. Delete a fatura emitida
5. **Verificar**: Foi removida?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___
- [ ] NAO ENCONTRADO NO MENU - Motivo: ___

### Teste H3 - Produtividade
1. Acesse **Producao > Produtividade**
2. **Verificar**: A pagina carrega sem erros?
3. Selecione uma safra
4. **Verificar**: Aparecem cards de resumo (producao total, custo/ha, etc)?
5. Selecione um talhao
6. **Verificar**: A tabela detalhada filtra pelo talhao?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO I - NAVEGACAO E INTERFACE

### Teste I1 - Menu Desktop Horizontal
1. Em tela desktop (largura > 1024px), verifique o menu superior
2. **Verificar**: O menu e horizontal com icones ACIMA do texto?
3. **Verificar**: Os submenus abrem ao passar o mouse (hover)?
4. **Verificar**: O menu "Despesas" foi REMOVIDO do grupo Financeiro?
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

### Teste I2 - Exportar CSV
1. Em Contas a Pagar, clique em **Exportar CSV**
2. **Verificar**: Um arquivo CSV foi baixado?
3. Abra o arquivo e verifique se os dados estao corretos
- [ ] PASSOU
- [ ] FALHOU - Motivo: ___

---

## BLOCO J - TESTE DE INTEGRIDADE CONTABIL (TESTE FINAL)

Este e o teste mais importante. Simula um ciclo contabil completo.

### Teste J1 - Ciclo Completo: Despesa > AP > Pagamento > Fluxo de Caixa

**Antes de comecar, anote:**
- Saldo atual da Conta Bancaria principal: $ ___________

**Passo 1 - Lancar Despesa**
1. Lance uma despesa "A Prazo" de $6.000 em 2 parcelas, fornecedor "Teste J1", categoria "Frete"

**Passo 2 - Verificar AP**
2. Va em Contas a Pagar > Contas
3. **Verificar**: Existem 2 parcelas de $3.000 cada para "Teste J1"?

**Passo 3 - Pagar Primeira Parcela**
4. Va em Contas a Pagar > Pagamento
5. Busque "Teste J1" no campo de busca
6. Marque a primeira parcela (1/2)
7. Clique "Realizar Pagamento"
8. Selecione a conta bancaria, confirme valor $3.000
9. Confirme o pagamento

**Passo 4 - Verificacoes Pos-Pagamento**
10. **Contas a Pagar > Contas**: Parcela 1/2 esta como "Pago"? Parcela 2/2 ainda "Aberto"?
11. **Fluxo de Caixa > Extrato**: Apareceu saida de $3.000 com referencia "Teste J1"?
12. **Fluxo de Caixa > Contas**: O saldo diminuiu exatamente $3.000 do valor anotado?
13. **Contas a Pagar > Historico**: A parcela paga aparece no historico?

**Resultado:**
- [ ] INTEGRIDADE CONTABIL OK - Todos os valores batem
- [ ] FALHA DE INTEGRIDADE - Detalhar: ___

### Teste J2 - Ciclo Completo: Despesa A Vista > AP Pago > Fluxo de Caixa

**Antes de comecar, anote:**
- Saldo atual da Conta Bancaria: $ ___________

1. Lance despesa "A Vista" de $2.500, fornecedor "Teste J2", com conta bancaria selecionada
2. **Contas a Pagar**: Existe entrada como "Pago" para $2.500?
3. **Fluxo de Caixa > Extrato**: Existe saida de $2.500?
4. **Saldo da conta**: Diminuiu exatamente $2.500?

**Resultado:**
- [ ] INTEGRIDADE CONTABIL OK
- [ ] FALHA DE INTEGRIDADE - Detalhar: ___

---

## RELATORIO FINAL

### Resumo Quantitativo

| Categoria | Total Testes | Passou | Falhou | Nao Testado |
|-----------|-------------|--------|--------|-------------|
| A - Fornecedores | 3 | | | |
| B - Faturas | 9 | | | |
| C - Despesas | 6 | | | |
| D - Contas a Pagar | 8 | | | |
| E - Contas a Receber | 3 | | | |
| F - Fluxo de Caixa | 5 | | | |
| G - Estoque | 1 | | | |
| H - Novos Modulos | 3 | | | |
| I - Interface | 2 | | | |
| J - Integridade Contabil | 2 | | | |
| **TOTAL** | **42** | | | |

### Falhas Encontradas (detalhar cada uma)

| # | Teste | Descricao da Falha | Severidade (Critica/Alta/Media/Baixa) | Impacto Contabil |
|---|-------|---------------------|---------------------------------------|------------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Funcionalidades que Passaram (confirmar)

| # | Teste | Observacoes |
|---|-------|-------------|
| 1 | | |
| 2 | | |

### Observacoes Gerais do Contador

(Escreva aqui suas impressoes gerais sobre o sistema financeiro: facilidade de uso, clareza dos dados, confiabilidade dos calculos, sugestoes de melhoria)

### Parecer Final

- [ ] **APROVADO** - Sistema financeiro funcional e confiavel para uso em producao
- [ ] **APROVADO COM RESSALVAS** - Funcional mas com pontos de atencao listados acima
- [ ] **REPROVADO** - Falhas criticas impedem o uso confiavel do sistema

**Data do teste**: ___/___/2026
**Testador**: _______________
