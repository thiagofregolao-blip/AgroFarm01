# Resultado da Auditoria Sprint 32 — AgroFarmDigital

**Data do teste**: 15/03/2026
**Testador**: Agente IA (Contador Profissional)
**Ambiente**: Producao (Railway)

---

## Tabela dos 32 Itens vs Resultado da Auditoria

| # | Item Sprint | Teste(s) | Status | O que a IA fez |
|---|-------------|----------|--------|----------------|
| 1 | Menu Desktop Horizontal | I1 | ✅ Passou | Verificou que o menu e horizontal com icones acima do texto, submenus abrem por hover, e "Despesas" foi removido do grupo Financeiro |
| 2 | Tipo Pessoa/Entidade Fornecedor | A1, A2 | ✅ Passou | Criou "Fornecedor Teste A1" tipo Provedor/P.Fisica - badges apareceram. Criou "Empresa Teste A2" tipo Cliente/P.Juridica com RUC - badges corretos. Observou que o campo se chama "Natureza" e nao "Entidade" |
| 3 | Validacao RUC Duplicado | A3 | ⚠️ Parcial | Tentou criar fornecedor com RUC duplicado "80012345-6". O sistema BLOQUEOU (nao criou), porem NAO exibiu mensagem de erro - modal ficou aberto sem feedback |
| 4 | Codeudor/Pagare (Garantias) | H1 | ⬜ Nao encontrado | Procurou no menu e tentou URLs diretas (/fazenda/garantias, /fazenda/codeudor). Modulo nao encontrado no sistema |
| 5 | Importacao Fatura WhatsApp | B1 | ⬜ Nao testavel | Sem integracao WhatsApp disponivel e sem faturas importadas no ambiente de teste |
| 6 | Deletar Fatura (limpeza FK) | B2 | ⬜ Nao testavel | Nao havia faturas no sistema para testar a delecao |
| 7 | Modal Nova Despesa (completo) | C1-C6 | ✅ Passou (5/6) | **C1**: Lancou despesa A Vista $5.000 diesel, verificou toast, AP "Pago", extrato -$5.000, saldo Banco Itau $7.500→$2.500. **C2**: Lancou A Prazo $12.000 em 3 parcelas, verificou 3 entradas AP de $4.000. **C3**: Nao testavel (sem fatura). **C4**: Testou modal busca fornecedor com filtro e badges. **C5**: Confirmou layout horizontal com botoes no rodape. **C6**: Confirmou tabela com colunas Data/Fornecedor/Categoria/Pagamento/Vencimento/Parcelas/Status/Valor |
| 8 | Aprovar Fatura "Somente Valor" | B3 | ⬜ Nao testavel | Sem faturas pendentes para testar aprovacao skip stock |
| 9 | Aprovar Fatura com Deposito | B4 | ⬜ Nao testavel | Sem faturas pendentes para testar aprovacao com deposito |
| 10 | Remocao Botao "Nova Conta" | D8 | ✅ Passou | Verificou que NAO existe botao "Nova Conta" na tela de Contas a Pagar |
| 11 | Exportar CSV | I2 | ⚠️ Parcial | Verificou que o botao "Exportar CSV" esta presente e ativado em Contas a Pagar. Nao conseguiu verificar o download do arquivo |
| 12 | Vinculacao Safra a Fatura | B6 | ⬜ Nao testavel | Sem faturas para verificar vinculacao automatica de safra |
| 13 | Filtros Busca Faturas | B7 | ⚠️ Parcial | Verificou que os campos de filtro existem (fornecedor, numero fatura, data). Digitou "teste" no filtro. Sem faturas para confirmar funcionamento real |
| 14 | Transferencia entre Depositos | G1 | ❌ Falhou | Selecionou CENTURION (180 LT), transferiu 10 LT de "Sem deposito" para "Armazem Norte". Historico registrou Saida+Entrada, mas saldos dos depositos NAO atualizaram — CENTURION permaneceu 180 LT em "Sem deposito" |
| 15 | Bot Precos Produtos Manuais | B8 | ⬜ Nao testavel | Bot WhatsApp indisponivel e sem acesso direto a API |
| 16 | Integracao Fornecedores c/ Financeiro | A1, C1, C4 | ✅ Passou | Ao lancar despesa, o modal busca fornecedor lista os cadastrados com badges. Fornecedor selecionado aparece no AP e historico |
| 17 | Edicao Fatura Apos Aprovacao | B5 | ⬜ Nao testavel | Sem faturas aprovadas para testar edicao |
| 18 | Campo Fornecedor/Cliente em AR | E1 | ✅ Passou | Verificou que o campo "Fornecedor / Cliente" esta presente na criacao de contas a receber |
| 19 | Edicao Contas a Receber | E2 | ❌ Falhou | Clicou "Editar" em conta a receber — pagina crashou completamente (tela branca). Erro: Select.Item com value vazio no Radix UI |
| 20 | Aba Recebimento em AR | E3 | ✅ Passou | Verificou aba "Recebimento" funciona: selecao por cliente, lista pendentes com checkboxes, barra resumo, confirmacao de recebimento |
| 21 | Remocao Botao "Novo Lancamento" | F1 | ✅ Passou | Verificou que NAO existe botao "Novo Lancamento" no Fluxo de Caixa |
| 22 | Filtros Contas a Pagar | D1 | ✅ Passou | Testou filtro Status "Aberto" (0 de 2 registros), limpou (2 de 2). Filtro fornecedor e vencimento presentes e funcionais |
| 23 | Edicao Contas a Pagar | D2 | ❌ Falhou | Clicou "Editar", alterou fornecedor, clicou "Salvar Alteracoes" multiplas vezes — botao nao respondeu, modal permaneceu aberto, sem erro no console |
| 24 | Integracao AR c/ Fluxo de Caixa | E3 | ✅ Passou | Verificado indiretamente via aba Recebimento que integra com fluxo de caixa |
| 25 | Aba Historico em AP | D7 | ✅ Passou | Verificou tabela com colunas Data Pgto/Fornecedor/Descricao/Parcela/Valor Pago. Mostrou 2 pagamentos corretamente |
| 26 | Aba Pagamento Novo Formato | D3, D4, D5, D6 | ✅ Passou | **D3**: Sem dropdown fornecedor, tabela pendentes com checkboxes, filtros, botao desabilitado. **D4**: Marcou 2 contas ($8.000), botao habilitou, modal pagamento, confirmou — saldos atualizaram exatamente. **D5**: Implicitamente testado via D4. **D6**: Checkbox cabecalho marcou/desmarcou todos |
| 27 | Cards Expansiveis Fluxo Caixa | F2 | ✅ Passou | Clicou card "Entradas (Mes)" — expandiu mostrando ultimas 5 entradas com detalhes |
| 28 | Transferencia entre Contas | F4, F5 | ✅/❌ | **F4 PASSOU**: Transferiu $1.000 de Banco Atlas para Banco Itau USD. Atlas: -$345.500→-$346.500, Itau: -$5.500→-$4.500. Historico registrado. **F5 FALHOU**: Editou data da transferencia mas a alteracao nao persistiu |
| 29 | Emissao de Fatura | H2 | ⬜ Nao encontrado | Procurou no menu e URLs diretas. Modulo nao encontrado no sistema |
| 30 | Produtividade por Talhao | H3 | ✅ Passou | Acessou Producao > Produtividade. Pagina carregou. Filtro de Safra com "Soja", filtro de Talhao, cards resumo (Producao Total, Media Produtividade, Custo Total) |
| 31 | Simbolo Moeda Despesa Vinculada | B9 | ⬜ Nao testavel | Sem faturas importadas com moeda detectada |
| 32 | Suporte Multiplas Moedas | B9 | ⬜ Nao testavel | Sem faturas com moedas diferentes para testar |

---

## Resumo Quantitativo

| Categoria | Total | ✅ Passou | ❌ Falhou | ⚠️ Parcial | ⬜ Nao Testavel |
|-----------|-------|-----------|----------|------------|----------------|
| Fornecedores (#2,3,16) | 3 | 2 | 0 | 1 | 0 |
| Faturas (#5,6,8,9,12,13,15,31,32) | 9 | 0 | 0 | 1 | 8 |
| Despesas (#7) | 6 | 5 | 0 | 0 | 1 |
| Contas a Pagar (#10,22,23,25,26) | 8 | 6 | 1 | 0 | 0 |
| Contas a Receber (#18,19,20,24) | 4 | 3 | 1 | 0 | 0 |
| Fluxo de Caixa (#21,27,28) | 5 | 4 | 1 | 0 | 0 |
| Estoque (#14) | 1 | 0 | 1 | 0 | 0 |
| Novos Modulos (#4,29,30) | 3 | 1 | 0 | 0 | 2 |
| Interface (#1,11,17) | 3 | 1 | 0 | 1 | 1 |
| Integridade Contabil | 2 | 2 | 0 | 0 | 0 |
| **TOTAL** | **44** | **24** | **4** | **3** | **12** |

---

## Bugs Encontrados (Severidade Alta)

| # | Item | Teste | Bug | Severidade | Acao |
|---|------|-------|-----|------------|------|
| 1 | #23 | D2 | Botao "Salvar Alteracoes" em AP nao funciona | Alta | Corrigir |
| 2 | #19 | E2 | Editar AR crasha a pagina (Select.Item value vazio) | Alta | Corrigir |
| 3 | #14 | G1 | Transferencia estoque: historico OK mas saldos depositos nao atualizam | Alta | Corrigir |
| 4 | #3 | A3 | Bloqueio RUC duplicado sem mensagem ao usuario | Media | Corrigir |
| 5 | #28 | F5 | Edicao de data em transferencia nao persiste | Media | Corrigir |

---

## Testes de Integridade Contabil (CRITICOS)

### J1 — Ciclo A Prazo: ✅ PASSOU
- Lancou $6.000 A Prazo em 2 parcelas
- AP: 2x $3.000 criadas
- Pagou parcela 1/2: AP 1/2 = "Pago", 2/2 = "Aberto"
- Fluxo de Caixa: -$3.000
- Banco Itau: -$4.500 → -$7.500 (exatamente -$3.000)
- Historico: parcela paga registrada

### J2 — Ciclo A Vista: ✅ PASSOU
- Lancou $2.500 A Vista com conta bancaria
- AP: entrada "Pago" de $2.500
- Fluxo de Caixa: -$2.500
- Banco Itau: -$7.500 → -$10.000 (exatamente -$2.500)

---

## Saldos Finais (apos todos os testes)

| Conta | Saldo Inicial | Saldo Final | Variacao |
|-------|---------------|-------------|----------|
| Banco Atlas USD | -$345.500 | -$346.500 | -$1.000 (transferencia F4) |
| Banco Itau USD | +$7.500 | -$10.000 | -$17.500 (C1+D4+F4+J1+J2) |
| Atlas PYG | Gs. 5.000.000 | Gs. 5.000.000 | sem alteracao |

---

## Veredicto

**APROVADO COM RESSALVAS** — O nucleo financeiro funciona com integridade contabil comprovada (J1+J2). Corrigir os 3 bugs de severidade Alta antes do release.
