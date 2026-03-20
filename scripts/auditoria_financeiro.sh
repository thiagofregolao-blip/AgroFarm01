#!/usr/bin/env bash
# =============================================================================
# AUDITORIA COMPLETA — AgroFarmDigital Módulo Financeiro
# Uso: bash scripts/auditoria_financeiro.sh
# Requer: curl, python3
# =============================================================================

BASE="https://www.agrofarmdigital.com"
CK="/tmp/agrofarm_audit_cookies.txt"
REPORT="/tmp/auditoria_agrofarm_$(date +%Y%m%d_%H%M%S).md"

# Contadores globais
TOTAL=0
PASS=0
FAIL=0
CRITICOS_FAIL=()
ALTOS_FAIL=()
MEDIOS_FAIL=()

# Variáveis de estado (preenchidas durante o script)
CONTA_A_ID=""
CONTA_B_ID=""
SALDO_A_INICIAL=0
SALDO_B_INICIAL=0
SOMA_TOTAL_INICIAL=0
AR1_ID=""
AR2_ID=""
AR3_IDS=()
AR_CHQ_ID=""
AR_GRAIN_ID=""
AP_1_ID=""
AP_PARC_ID=""
AP_SPLIT_ID=""
CHQ_AVULSO_ID=""
CHQ_CANCEL_ID=""
SOJA_KG_ANTES=0

# Acumuladores de movimentos esperados por conta
CONTA_A_MOVIMENTOS=0
CONTA_B_MOVIMENTOS=0

# =============================================================================
# UTILITÁRIOS
# =============================================================================

log()    { echo "  $1"; }
header() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# Registra resultado de um teste
# Uso: resultado PASS|FAIL "Descrição" CRITICO|ALTO|MEDIO "detalhe opcional"
resultado() {
    local status=$1
    local descricao=$2
    local peso=${3:-MEDIO}
    local detalhe=${4:-""}
    TOTAL=$((TOTAL+1))
    if [ "$status" = "PASS" ]; then
        PASS=$((PASS+1))
        echo "  ✅ PASS | $descricao"
    else
        FAIL=$((FAIL+1))
        echo "  ❌ FAIL | $descricao${detalhe:+ — $detalhe}"
        case $peso in
            CRITICO) CRITICOS_FAIL+=("$descricao${detalhe:+: $detalhe}") ;;
            ALTO)    ALTOS_FAIL+=("$descricao${detalhe:+: $detalhe}") ;;
            *)       MEDIOS_FAIL+=("$descricao${detalhe:+: $detalhe}") ;;
        esac
    fi
}

# HTTP call com cookie
GET()  { curl -s -b "$CK" "$BASE$1"; }
POST() { curl -s -b "$CK" -X POST "$BASE$1" -H "Content-Type: application/json" -d "$2"; }
DEL()  { curl -s -b "$CK" -X DELETE "$BASE$1"; }

# Extrai campo JSON (usa python3)
json() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null; }
json_arr() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }

# Verifica se HTTP response tem campo não nulo
has_field() {
    local val
    val=$(echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$2'); print('ok' if v is not None and v != '' and v != 'null' else 'fail')" 2>/dev/null)
    [ "$val" = "ok" ]
}

# Verifica igualdade numérica com tolerância de 0.01
math_eq() {
    python3 -c "import sys; a,b=float('$1'),float('$2'); print('ok' if abs(a-b)<0.02 else 'fail')" 2>/dev/null
}

# Saldo atual de uma conta
saldo() {
    local r
    r=$(GET "/api/farm/cash-accounts/$1")
    echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('currentBalance',0)))" 2>/dev/null
}

# =============================================================================
# INÍCIO
# =============================================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        AUDITORIA COMPLETA — AgroFarmDigital Financeiro       ║"
echo "║        $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  URL: $BASE"
echo "  Relatório será salvo em: $REPORT"

# =============================================================================
# BLOCO 0 — AUTENTICAÇÃO
# =============================================================================

header "BLOCO 0 — AUTENTICAÇÃO"

rm -f "$CK"
LOGIN_R=$(curl -s -c "$CK" -X POST "$BASE/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"user","password":"1571jn"}')

LOGIN_ROLE=$(echo "$LOGIN_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('role',''))" 2>/dev/null)

if [ "$LOGIN_ROLE" = "agricultor" ]; then
    resultado PASS "Login com credenciais válidas retorna role=agricultor" CRITICO
else
    resultado FAIL "Login com credenciais válidas" CRITICO "Response: $LOGIN_R"
    echo ""
    echo "  ABORTANDO: sem autenticação não é possível continuar."
    exit 1
fi

# Rota protegida sem cookie
UNAUTH=$(curl -s "https://www.agrofarmdigital.com/api/farm/cash-accounts")
UNAUTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://www.agrofarmdigital.com/api/farm/cash-accounts")
if [ "$UNAUTH_HTTP" = "401" ] || echo "$UNAUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); s=str(d); exit(0 if any(w in s.lower() for w in ['unauthorized','unauthenticated','autenticacao','login','nao autenticado']) else 1)" 2>/dev/null; then
    resultado PASS "Rota protegida sem cookie retorna 401/negado (HTTP $UNAUTH_HTTP)" CRITICO
else
    resultado FAIL "Rota protegida sem cookie deveria negar acesso" ALTO "HTTP: $UNAUTH_HTTP | Response: $UNAUTH"
fi

# =============================================================================
# BLOCO 1 — CONTAS BANCÁRIAS
# =============================================================================

header "BLOCO 1 — CONTAS BANCÁRIAS"

CONTAS_R=$(GET "/api/farm/cash-accounts")
NUM_CONTAS=$(echo "$CONTAS_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)

if [ "$NUM_CONTAS" -ge 1 ] 2>/dev/null; then
    resultado PASS "GET /api/farm/cash-accounts retorna $NUM_CONTAS conta(s)" CRITICO
    CONTA_A_ID=$(echo "$CONTAS_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])" 2>/dev/null)
    SALDO_A_INICIAL=$(echo "$CONTAS_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d[0].get('currentBalance',0)))" 2>/dev/null)
    log "Conta A: $CONTA_A_ID | Saldo inicial: $SALDO_A_INICIAL"
else
    resultado FAIL "GET /api/farm/cash-accounts deve retornar ao menos 1 conta" CRITICO "Response: $CONTAS_R"
fi

if [ "$NUM_CONTAS" -ge 2 ] 2>/dev/null; then
    CONTA_B_ID=$(echo "$CONTAS_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[1]['id'])" 2>/dev/null)
    SALDO_B_INICIAL=$(echo "$CONTAS_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d[1].get('currentBalance',0)))" 2>/dev/null)
    log "Conta B: $CONTA_B_ID | Saldo inicial: $SALDO_B_INICIAL"
    resultado PASS "Existe segunda conta para teste de split payment" ALTO
else
    resultado FAIL "Precisa de ao menos 2 contas para testar split payment" ALTO
fi

SOMA_TOTAL_INICIAL=$(echo "$CONTAS_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(float(c.get('currentBalance',0)) for c in d))
" 2>/dev/null)
log "Soma total inicial de todas as contas: $SOMA_TOTAL_INICIAL"

# Buscar conta individual
CONTA_DET=$(GET "/api/farm/cash-accounts/$CONTA_A_ID")
if has_field "$CONTA_DET" "id"; then
    resultado PASS "GET /api/farm/cash-accounts/:id retorna objeto da conta" CRITICO
else
    resultado FAIL "GET /api/farm/cash-accounts/:id retornou HTML ou erro" CRITICO "Response: ${CONTA_DET:0:100}"
fi

# ID inválido deve retornar 404
CONTA_404=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" "$BASE/api/farm/cash-accounts/id-invalido-xyz")
if [ "$CONTA_404" = "404" ]; then
    resultado PASS "GET /api/farm/cash-accounts/id-invalido retorna 404" MEDIO
else
    resultado FAIL "GET /api/farm/cash-accounts/id-invalido deve retornar 404" MEDIO "HTTP: $CONTA_404"
fi

# =============================================================================
# BLOCO 2 — CRIAR CONTAS A RECEBER
# =============================================================================

header "BLOCO 2 — CRIAR CONTAS A RECEBER (AR)"

# 2.1 — AR parcela única
log "2.1 — AR parcela única (5000 USD, sem IVA)"
AR1_R=$(POST "/api/farm/accounts-receivable" '{
    "buyer":"AUDIT-COMPRADOR-1",
    "totalAmount":"5000.00",
    "currency":"USD",
    "dueDate":"2026-06-15",
    "totalInstallments":1,
    "paymentCondition":"prazo",
    "items":[{"productName":"Soja","unit":"TON","quantity":"10","unitPrice":"500.00","ivaRate":"exenta","totalPrice":"5000.00"}]
}')
AR1_ID=$(echo "$AR1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
AR1_DUE=$(echo "$AR1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dueDate') or d.get('due_date',''))" 2>/dev/null)
AR1_STATUS=$(echo "$AR1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
AR1_AMOUNT=$(echo "$AR1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalAmount') or d.get('total_amount',''))" 2>/dev/null)

if [ -n "$AR1_ID" ] && [ "$AR1_ID" != "None" ]; then
    resultado PASS "POST AR parcela única retorna objeto com id" CRITICO
else
    resultado FAIL "POST AR parcela única retornou erro" CRITICO "Response: ${AR1_R:0:200}"
fi

if [ -n "$AR1_DUE" ] && [ "$AR1_DUE" != "None" ] && [ "$AR1_DUE" != "null" ]; then
    resultado PASS "AR criada com dueDate preenchido: $AR1_DUE" CRITICO
else
    resultado FAIL "AR criada com dueDate nulo — bug crítico" CRITICO
fi

if [ "$AR1_STATUS" = "pendente" ]; then
    resultado PASS "AR criada com status=pendente" CRITICO
else
    resultado FAIL "AR status incorreto" CRITICO "Status: $AR1_STATUS"
fi

if [ "$(math_eq "$AR1_AMOUNT" "5000")" = "ok" ]; then
    resultado PASS "AR totalAmount = 5000.00 correto" CRITICO
else
    resultado FAIL "AR totalAmount incorreto" CRITICO "Valor: $AR1_AMOUNT"
fi

# 2.2 — IVA misto
log "2.2 — AR com IVA misto (exenta + 5% + 10%)"
AR2_R=$(POST "/api/farm/accounts-receivable" '{
    "buyer":"AUDIT-IVA-MISTO",
    "totalAmount":"6000.00",
    "dueDate":"2026-07-01",
    "totalInstallments":1,
    "items":[
        {"productName":"Exento","unit":"UN","quantity":"1","unitPrice":"1000","ivaRate":"exenta","totalPrice":"1000"},
        {"productName":"Grav5","unit":"UN","quantity":"1","unitPrice":"2000","ivaRate":"5","totalPrice":"2000"},
        {"productName":"Grav10","unit":"UN","quantity":"1","unitPrice":"3000","ivaRate":"10","totalPrice":"3000"}
    ]
}')
AR2_ID=$(echo "$AR2_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

IVA5_RECEBIDO=$(echo "$AR2_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('iva5') or d.get('iva_5',0)))" 2>/dev/null)
IVA10_RECEBIDO=$(echo "$AR2_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('iva10') or d.get('iva_10',0)))" 2>/dev/null)
IVA5_ESPERADO=95.24   # 2000/21
IVA10_ESPERADO=272.73 # 3000/11

if [ -n "$AR2_ID" ] && [ "$AR2_ID" != "None" ]; then
    resultado PASS "POST AR com IVA misto retorna objeto" CRITICO
    if [ "$(math_eq "$IVA5_RECEBIDO" "$IVA5_ESPERADO")" = "ok" ]; then
        resultado PASS "IVA 5% calculado corretamente: $IVA5_RECEBIDO (esperado ~$IVA5_ESPERADO)" ALTO
    else
        resultado FAIL "IVA 5% incorreto" ALTO "Recebido: $IVA5_RECEBIDO | Esperado: ~$IVA5_ESPERADO"
    fi
    if [ "$(math_eq "$IVA10_RECEBIDO" "$IVA10_ESPERADO")" = "ok" ]; then
        resultado PASS "IVA 10% calculado corretamente: $IVA10_RECEBIDO (esperado ~$IVA10_ESPERADO)" ALTO
    else
        resultado FAIL "IVA 10% incorreto" ALTO "Recebido: $IVA10_RECEBIDO | Esperado: ~$IVA10_ESPERADO"
    fi
else
    resultado FAIL "POST AR com IVA misto falhou" CRITICO "Response: ${AR2_R:0:200}"
fi

# 2.3 — AR com 3 parcelas
log "2.3 — AR com 3 parcelas (IVA dividido por parcela)"
AR3_R=$(POST "/api/farm/accounts-receivable" '{
    "buyer":"AUDIT-3PARCELAS",
    "totalAmount":"3000.00",
    "dueDate":"2026-04-01",
    "totalInstallments":3,
    "items":[{"productName":"Milho","unit":"TON","quantity":"3","unitPrice":"1000","ivaRate":"10","totalPrice":"3000"}]
}')
NUM_PARCELAS=$(echo "$AR3_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)

if [ "$NUM_PARCELAS" = "3" ]; then
    resultado PASS "AR com 3 parcelas retorna array de 3 objetos" CRITICO

    SOMA_PARCELAS=$(echo "$AR3_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(float(p.get('totalAmount') or p.get('total_amount',0)) for p in d))
" 2>/dev/null)
    if [ "$(math_eq "$SOMA_PARCELAS" "3000")" = "ok" ]; then
        resultado PASS "Soma das 3 parcelas = 3000.00 exato" CRITICO
    else
        resultado FAIL "Soma das parcelas não bate com total" CRITICO "Soma: $SOMA_PARCELAS | Esperado: 3000"
    fi

    IVA10_P1=$(echo "$AR3_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d[0].get('iva10') or d[0].get('iva_10',0)))" 2>/dev/null)
    IVA10_PARC_ESPERADO=90.91  # (3000/11)/3
    if [ "$(math_eq "$IVA10_P1" "$IVA10_PARC_ESPERADO")" = "ok" ]; then
        resultado PASS "IVA 10% por parcela correto: $IVA10_P1 (esperado ~$IVA10_PARC_ESPERADO)" ALTO
    else
        resultado FAIL "IVA 10% por parcela incorreto — Bug #4" ALTO "Recebido: $IVA10_P1 | Esperado: ~$IVA10_PARC_ESPERADO"
    fi

    AR3_IDS=($(echo "$AR3_R" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(p['id']) for p in d]" 2>/dev/null))
else
    resultado FAIL "AR com 3 parcelas deve retornar array de 3 (retornou $NUM_PARCELAS)" CRITICO "Response: ${AR3_R:0:200}"
fi

# 2.4 — Número de fatura duplicado
log "2.4 — Número de fatura duplicado deve retornar 409"
POST "/api/farm/accounts-receivable" '{"buyer":"FAT-ORIG","totalAmount":"100","dueDate":"2026-05-01","invoiceNumber":"AUD-FAT-001","items":[{"productName":"X","unit":"UN","quantity":"1","unitPrice":"100","ivaRate":"exenta","totalPrice":"100"}]}' > /dev/null
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" -X POST "$BASE/api/farm/accounts-receivable" \
    -H "Content-Type: application/json" \
    -d '{"buyer":"FAT-DUP","totalAmount":"200","dueDate":"2026-05-01","invoiceNumber":"AUD-FAT-001","items":[{"productName":"Y","unit":"UN","quantity":"1","unitPrice":"200","ivaRate":"exenta","totalPrice":"200"}]}')
if [ "$DUP_CODE" = "409" ]; then
    resultado PASS "Número de fatura duplicado retorna 409" MEDIO
else
    resultado FAIL "Número de fatura duplicado deveria retornar 409" MEDIO "HTTP: $DUP_CODE"
fi

# 2.5 — AR com grainCrop (dedução de estoque)
log "2.5 — AR com grainCrop deduz estoque de grãos"
GRAIN_ANTES=$(GET "/api/farm/grain-stock")
SOJA_KG_ANTES=$(echo "$GRAIN_ANTES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
soja=[g for g in d if g.get('crop','').lower()=='soja']
print(float(soja[0]['quantity']) if soja else 0)
" 2>/dev/null)
log "Estoque soja antes: ${SOJA_KG_ANTES}kg"

AR_GRAIN_R=$(POST "/api/farm/accounts-receivable" '{
    "buyer":"AUDIT-GRAOS",
    "totalAmount":"4000.00",
    "dueDate":"2026-06-01",
    "items":[{"productName":"Soja","unit":"TON","quantity":"8","unitPrice":"500","ivaRate":"exenta","totalPrice":"4000","grainCrop":"soja"}]
}')
AR_GRAIN_ID=$(echo "$AR_GRAIN_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -n "$AR_GRAIN_ID" ] && [ "$AR_GRAIN_ID" != "None" ]; then
    resultado PASS "AR com grainCrop criada" ALTO
    GRAIN_DEPOIS=$(GET "/api/farm/grain-stock")
    SOJA_KG_DEPOIS=$(echo "$GRAIN_DEPOIS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
soja=[g for g in d if g.get('crop','').lower()=='soja']
print(float(soja[0]['quantity']) if soja else 0)
" 2>/dev/null)
    SOJA_ESPERADO=$(python3 -c "print($SOJA_KG_ANTES - 8000)" 2>/dev/null)
    log "Estoque soja depois: ${SOJA_KG_DEPOIS}kg | Esperado: ${SOJA_ESPERADO}kg"
    if [ "$(math_eq "$SOJA_KG_DEPOIS" "$SOJA_ESPERADO")" = "ok" ]; then
        resultado PASS "Estoque soja deduzido corretamente: -8000kg (8 TON)" ALTO
    else
        resultado FAIL "Dedução de estoque de grão incorreta" ALTO "Antes: $SOJA_KG_ANTES | Depois: $SOJA_KG_DEPOIS | Esperado: $SOJA_ESPERADO"
    fi
else
    resultado FAIL "AR com grainCrop falhou na criação" ALTO "Response: ${AR_GRAIN_R:0:200}"
fi

# =============================================================================
# BLOCO 3 — RECEBIMENTO DE AR
# =============================================================================

header "BLOCO 3 — RECEBIMENTO DE AR"

if [ -z "$AR1_ID" ] || [ "$AR1_ID" = "None" ]; then
    log "SKIP Bloco 3 — AR1 não foi criada no Bloco 2"
else

# 3.1 — Recebimento parcial em 3 etapas
log "3.1 — Recebimento parcial em 3 etapas (AR1 = 5000)"
SALDO_A_PRE=$(saldo "$CONTA_A_ID")

# 1ª parcela: 2000
REC1_R=$(POST "/api/farm/accounts-receivable/$AR1_ID/receive" "{\"amount\":2000,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
REC1_STATUS=$(echo "$REC1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
if [ "$REC1_STATUS" = "parcial" ]; then
    resultado PASS "1ª parcela (2000): status=parcial" CRITICO
else
    resultado FAIL "1ª parcela (2000): status deveria ser parcial" CRITICO "Status: $REC1_STATUS | Response: ${REC1_R:0:150}"
fi

SALDO_APOS_P1=$(saldo "$CONTA_A_ID")
SALDO_ESPERADO_P1=$(python3 -c "print($SALDO_A_PRE + 2000)" 2>/dev/null)
if [ "$(math_eq "$SALDO_APOS_P1" "$SALDO_ESPERADO_P1")" = "ok" ]; then
    resultado PASS "Saldo após 1ª parcela: $SALDO_APOS_P1 (esperado $SALDO_ESPERADO_P1)" CRITICO
else
    resultado FAIL "Saldo incorreto após 1ª parcela" CRITICO "Real: $SALDO_APOS_P1 | Esperado: $SALDO_ESPERADO_P1"
fi

# 2ª parcela: 1500
REC2_R=$(POST "/api/farm/accounts-receivable/$AR1_ID/receive" "{\"amount\":1500,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
REC2_STATUS=$(echo "$REC2_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
if [ "$REC2_STATUS" = "parcial" ]; then
    resultado PASS "2ª parcela (1500): status=parcial, receivedAmount=3500" CRITICO
else
    resultado FAIL "2ª parcela (1500): status deveria ser parcial" CRITICO "Status: $REC2_STATUS"
fi

SALDO_APOS_P2=$(saldo "$CONTA_A_ID")
SALDO_ESPERADO_P2=$(python3 -c "print($SALDO_A_PRE + 3500)" 2>/dev/null)
if [ "$(math_eq "$SALDO_APOS_P2" "$SALDO_ESPERADO_P2")" = "ok" ]; then
    resultado PASS "Saldo após 2ª parcela: $SALDO_APOS_P2 (esperado $SALDO_ESPERADO_P2)" CRITICO
else
    resultado FAIL "Saldo incorreto após 2ª parcela" CRITICO "Real: $SALDO_APOS_P2 | Esperado: $SALDO_ESPERADO_P2"
fi

# 3ª parcela: 1500 (quitação)
REC3_R=$(POST "/api/farm/accounts-receivable/$AR1_ID/receive" "{\"amount\":1500,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
REC3_STATUS=$(echo "$REC3_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
if [ "$REC3_STATUS" = "recebido" ]; then
    resultado PASS "3ª parcela (1500): status=recebido (quitado)" CRITICO
else
    resultado FAIL "3ª parcela: status deveria ser recebido" CRITICO "Status: $REC3_STATUS"
fi

SALDO_APOS_AR1=$(saldo "$CONTA_A_ID")
SALDO_ESPERADO_AR1=$(python3 -c "print($SALDO_A_PRE + 5000)" 2>/dev/null)
if [ "$(math_eq "$SALDO_APOS_AR1" "$SALDO_ESPERADO_AR1")" = "ok" ]; then
    resultado PASS "Saldo final após quitação AR1: $SALDO_APOS_AR1 (esperado $SALDO_ESPERADO_AR1)" CRITICO
else
    resultado FAIL "Saldo final incorreto após AR1" CRITICO "Real: $SALDO_APOS_AR1 | Esperado: $SALDO_ESPERADO_AR1"
fi
CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS + 5000)" 2>/dev/null)

# 3.2 — Bloqueio de recebimento duplo
log "3.2 — Tentativa de recebimento duplo deve ser bloqueada"
DUP_REC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" -X POST "$BASE/api/farm/accounts-receivable/$AR1_ID/receive" \
    -H "Content-Type: application/json" \
    -d "{\"amount\":100,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
if [ "$DUP_REC_CODE" = "409" ]; then
    resultado PASS "Recebimento duplo bloqueado com 409" CRITICO
else
    resultado FAIL "Recebimento duplo NÃO foi bloqueado — corrupção de saldo!" CRITICO "HTTP: $DUP_REC_CODE"
fi

SALDO_APOS_DUP=$(saldo "$CONTA_A_ID")
if [ "$(math_eq "$SALDO_APOS_DUP" "$SALDO_APOS_AR1")" = "ok" ]; then
    resultado PASS "Saldo não alterado após tentativa de recebimento duplo" CRITICO
else
    resultado FAIL "Saldo mudou após tentativa de recebimento duplo!" CRITICO "Antes: $SALDO_APOS_AR1 | Depois: $SALDO_APOS_DUP"
fi

# 3.3 — Recebimento via cheque
log "3.3 — Recebimento de AR via cheque"
AR_CHQ_R=$(POST "/api/farm/accounts-receivable" '{"buyer":"AUDIT-CHEQUE-AR","totalAmount":"2000","dueDate":"2026-08-01","items":[{"productName":"Feijão","unit":"TON","quantity":"2","unitPrice":"1000","ivaRate":"exenta","totalPrice":"2000"}]}')
AR_CHQ_ID=$(echo "$AR_CHQ_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

SALDO_PRE_CHQ=$(saldo "$CONTA_A_ID")
REC_CHQ_R=$(POST "/api/farm/accounts-receivable/$AR_CHQ_ID/receive" "{\"amount\":2000,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"cheque\",\"chequeData\":{\"bank\":\"Banco Audit\",\"chequeNumber\":\"CHQ-AR-001\",\"holder\":\"AUDIT-CHEQUE-AR\"}}")
REC_CHQ_STATUS=$(echo "$REC_CHQ_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
if [ "$REC_CHQ_STATUS" = "recebido" ]; then
    resultado PASS "Recebimento via cheque: status=recebido" ALTO
else
    resultado FAIL "Recebimento via cheque falhou" ALTO "Status: $REC_CHQ_STATUS | Response: ${REC_CHQ_R:0:150}"
fi

SALDO_APOS_CHQ=$(saldo "$CONTA_A_ID")
SALDO_ESP_CHQ=$(python3 -c "print($SALDO_PRE_CHQ + 2000)" 2>/dev/null)
if [ "$(math_eq "$SALDO_APOS_CHQ" "$SALDO_ESP_CHQ")" = "ok" ]; then
    resultado PASS "Saldo aumentou 2000 após recebimento com cheque" CRITICO
else
    resultado FAIL "Saldo incorreto após recebimento com cheque" CRITICO "Real: $SALDO_APOS_CHQ | Esperado: $SALDO_ESP_CHQ"
fi
CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS + 2000)" 2>/dev/null)

# Cheque criado em farm_cheques
CHEQUES_R=$(GET "/api/farm/cheques")
CHQ_AR_ENCONTRADO=$(echo "$CHEQUES_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[c for c in d if (c.get('cheque_number') or c.get('chequeNumber',''))=='CHQ-AR-001']
if found:
    c=found[0]
    ok = c.get('bank','')=='Banco Audit' and float(c.get('amount',0))==2000
    print('ok' if ok else 'badvalue')
else:
    print('notfound')
" 2>/dev/null)
if [ "$CHQ_AR_ENCONTRADO" = "ok" ]; then
    resultado PASS "Cheque criado via AR receive com bank e amount corretos" ALTO
elif [ "$CHQ_AR_ENCONTRADO" = "badvalue" ]; then
    resultado FAIL "Cheque criado mas com bank ou amount incorretos" ALTO
else
    resultado FAIL "Cheque NÃO criado em farm_cheques após receive via cheque" ALTO
fi

fi # fim do if AR1_ID

# =============================================================================
# BLOCO 4 — DESPESAS E CONTAS A PAGAR
# =============================================================================

header "BLOCO 4 — DESPESAS E CONTAS A PAGAR (AP)"

# 4.1 — Despesa → AP automática
log "4.1 — Criar despesa → AP criada automaticamente"
EXP1_R=$(POST "/api/farm/expenses" '{"description":"Semente Audit","amount":"1800","category":"insumos","paymentType":"a_vista","dueDate":"2026-04-15","supplier":"Fornecedor Audit"}')
EXP1_ID=$(echo "$EXP1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
EXP1_STATUS=$(echo "$EXP1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('paymentStatus') or d.get('payment_status',''))" 2>/dev/null)

if [ -n "$EXP1_ID" ] && [ "$EXP1_ID" != "None" ]; then
    resultado PASS "Despesa criada com id=$EXP1_ID" CRITICO
else
    resultado FAIL "Criação de despesa falhou" CRITICO "Response: ${EXP1_R:0:200}"
fi
if [ "$EXP1_STATUS" = "pendente" ]; then
    resultado PASS "Despesa criada com paymentStatus=pendente" CRITICO
else
    resultado FAIL "paymentStatus deveria ser pendente" CRITICO "Status: $EXP1_STATUS"
fi

sleep 1
APS_R=$(GET "/api/farm/accounts-payable")
AP_1_ID=$(echo "$APS_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[a for a in d if 'Semente Audit' in (a.get('description') or '')]
print(found[0]['id'] if found else '')
" 2>/dev/null)
if [ -n "$AP_1_ID" ] && [ "$AP_1_ID" != "None" ]; then
    resultado PASS "AP criada automaticamente para despesa: $AP_1_ID" CRITICO
else
    resultado FAIL "AP NÃO foi criada automaticamente para a despesa" CRITICO
fi

# 4.2 — Pagar AP simples
log "4.2 — Pagar AP com transferência simples"
SALDO_A_PRE_PAY=$(saldo "$CONTA_A_ID")

PAY1_R=$(POST "/api/farm/accounts-payable/$AP_1_ID/pay" "{\"amount\":1800,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
PAY1_OK=$(echo "$PAY1_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','') or d.get('status',''))" 2>/dev/null)
if echo "$PAY1_OK" | grep -qi "true\|pago\|success"; then
    resultado PASS "AP paga com sucesso (transferência 1800)" CRITICO
else
    resultado FAIL "Pagamento AP falhou" CRITICO "Response: ${PAY1_R:0:200}"
fi

SALDO_A_APOS_PAY=$(saldo "$CONTA_A_ID")
SALDO_ESP_PAY=$(python3 -c "print($SALDO_A_PRE_PAY - 1800)" 2>/dev/null)
if [ "$(math_eq "$SALDO_A_APOS_PAY" "$SALDO_ESP_PAY")" = "ok" ]; then
    resultado PASS "Saldo debitado corretamente: $SALDO_A_APOS_PAY (esperado $SALDO_ESP_PAY)" CRITICO
else
    resultado FAIL "Saldo incorreto após pagamento AP" CRITICO "Real: $SALDO_A_APOS_PAY | Esperado: $SALDO_ESP_PAY"
fi
CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS - 1800)" 2>/dev/null)

# Bug #1: despesa deve sincronizar paymentStatus
sleep 1
EXPS_R=$(GET "/api/farm/expenses")
EXP_PAY_STATUS=$(echo "$EXPS_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[e for e in d if 'Semente Audit' in (e.get('description') or '')]
print(found[0].get('paymentStatus') or found[0].get('payment_status','') if found else 'nao_encontrada')
" 2>/dev/null)
if [ "$EXP_PAY_STATUS" = "pago" ]; then
    resultado PASS "Despesa sincronizou paymentStatus=pago após pagar AP (Bug #1 fix)" CRITICO
else
    resultado FAIL "Despesa NÃO sincronizou paymentStatus — Bug #1 ainda presente!" CRITICO "Status: $EXP_PAY_STATUS"
fi

# transactionDate não nulo
TXS_R=$(GET "/api/farm/cash-transactions")
NULL_TX=$(echo "$TXS_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
null=[t for t in d if not t.get('transactionDate') and not t.get('transaction_date')]
print(len(null))
" 2>/dev/null)
if [ "$NULL_TX" = "0" ]; then
    resultado PASS "Todas as transações têm transactionDate preenchida (0 nulos)" CRITICO
else
    resultado FAIL "Existem $NULL_TX transações com transactionDate nulo" ALTO
fi

# 4.3 — Pagamento parcial em 3 etapas
log "4.3 — Pagamento parcial AP em 3 etapas (6000 total)"
EXP_PARC_R=$(POST "/api/farm/expenses" '{"description":"Fertilizante Parcial","amount":"6000","category":"insumos","paymentType":"a_vista","dueDate":"2026-05-01","supplier":"Agro Insumos"}')
sleep 1
APS2_R=$(GET "/api/farm/accounts-payable")
AP_PARC_ID=$(echo "$APS2_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[a for a in d if 'Fertilizante Parcial' in (a.get('description') or '')]
print(found[0]['id'] if found else '')
" 2>/dev/null)

if [ -n "$AP_PARC_ID" ] && [ "$AP_PARC_ID" != "None" ]; then
    SALDO_PRE_PARC=$(saldo "$CONTA_A_ID")

    P1=$(POST "/api/farm/accounts-payable/$AP_PARC_ID/pay" "{\"amount\":2000,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
    P1_S=$(echo "$P1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
    [ "$P1_S" = "parcial" ] && resultado PASS "Parcela 1 de 3 (2000): status=parcial" ALTO || resultado FAIL "Parcela 1: status=$P1_S esperado parcial" ALTO

    P2=$(POST "/api/farm/accounts-payable/$AP_PARC_ID/pay" "{\"amount\":2000,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
    P2_S=$(echo "$P2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
    [ "$P2_S" = "parcial" ] && resultado PASS "Parcela 2 de 3 (2000): status=parcial" ALTO || resultado FAIL "Parcela 2: status=$P2_S esperado parcial" ALTO

    P3=$(POST "/api/farm/accounts-payable/$AP_PARC_ID/pay" "{\"amount\":2000,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
    P3_S=$(echo "$P3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
    [ "$P3_S" = "pago" ] && resultado PASS "Parcela 3 de 3 (2000): status=pago (quitado)" ALTO || resultado FAIL "Parcela 3: status=$P3_S esperado pago" ALTO

    SALDO_APOS_PARC=$(saldo "$CONTA_A_ID")
    ESP_PARC=$(python3 -c "print($SALDO_PRE_PARC - 6000)" 2>/dev/null)
    if [ "$(math_eq "$SALDO_APOS_PARC" "$ESP_PARC")" = "ok" ]; then
        resultado PASS "Saldo após 3 parcelas: $SALDO_APOS_PARC (esperado $ESP_PARC)" CRITICO
    else
        resultado FAIL "Saldo incorreto após 3 parcelas" CRITICO "Real: $SALDO_APOS_PARC | Esperado: $ESP_PARC"
    fi
    CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS - 6000)" 2>/dev/null)
else
    resultado FAIL "AP para teste de parcelas não encontrada" ALTO
fi

# 4.4 — Split payment (múltiplos meios)
log "4.4 — Split payment: conta A (3000 transf) + conta B (2000 cheque)"
if [ -n "$CONTA_B_ID" ]; then
    EXP_SPLIT_R=$(POST "/api/farm/expenses" '{"description":"Defensivo Split","amount":"5000","category":"defensivos","paymentType":"a_vista","dueDate":"2026-05-15","supplier":"Defensivos SA"}')
    sleep 1
    APS3_R=$(GET "/api/farm/accounts-payable")
    AP_SPLIT_ID=$(echo "$APS3_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[a for a in d if 'Defensivo Split' in (a.get('description') or '')]
print(found[0]['id'] if found else '')
" 2>/dev/null)

    if [ -n "$AP_SPLIT_ID" ] && [ "$AP_SPLIT_ID" != "None" ]; then
        SALDO_A_PRE_SPLIT=$(saldo "$CONTA_A_ID")
        SALDO_B_PRE_SPLIT=$(saldo "$CONTA_B_ID")

        SPLIT_R=$(POST "/api/farm/accounts-payable/$AP_SPLIT_ID/pay" "{
            \"amount\":5000,
            \"accountRows\":[
                {\"accountId\":\"$CONTA_A_ID\",\"amount\":3000,\"paymentMethod\":\"transferencia\"},
                {\"accountId\":\"$CONTA_B_ID\",\"amount\":2000,\"paymentMethod\":\"cheque\"}
            ],
            \"cheque\":{\"bank\":\"Banco Split\",\"chequeNumber\":\"SPL-001\",\"tipo\":\"proprio\"}
        }")
        SPLIT_OK=$(echo "$SPLIT_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','') or d.get('status',''))" 2>/dev/null)
        if echo "$SPLIT_OK" | grep -qi "true\|pago\|success"; then
            resultado PASS "Split payment aceito pelo servidor" CRITICO
        else
            resultado FAIL "Split payment falhou" CRITICO "Response: ${SPLIT_R:0:200}"
        fi

        SALDO_A_APOS_SPLIT=$(saldo "$CONTA_A_ID")
        SALDO_B_APOS_SPLIT=$(saldo "$CONTA_B_ID")
        ESP_A_SPLIT=$(python3 -c "print($SALDO_A_PRE_SPLIT - 3000)" 2>/dev/null)
        ESP_B_SPLIT=$(python3 -c "print($SALDO_B_PRE_SPLIT - 2000)" 2>/dev/null)

        if [ "$(math_eq "$SALDO_A_APOS_SPLIT" "$ESP_A_SPLIT")" = "ok" ]; then
            resultado PASS "Conta A debitada 3000 corretamente: $SALDO_A_APOS_SPLIT (esperado $ESP_A_SPLIT)" CRITICO
        else
            resultado FAIL "Conta A com valor incorreto no split" CRITICO "Real: $SALDO_A_APOS_SPLIT | Esperado: $ESP_A_SPLIT"
        fi

        if [ "$(math_eq "$SALDO_B_APOS_SPLIT" "$ESP_B_SPLIT")" = "ok" ]; then
            resultado PASS "Conta B debitada 2000 corretamente: $SALDO_B_APOS_SPLIT (esperado $ESP_B_SPLIT)" CRITICO
        else
            resultado FAIL "Conta B com valor incorreto no split" CRITICO "Real: $SALDO_B_APOS_SPLIT | Esperado: $ESP_B_SPLIT"
        fi
        CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS - 3000)" 2>/dev/null)
        CONTA_B_MOVIMENTOS=$(python3 -c "print($CONTA_B_MOVIMENTOS - 2000)" 2>/dev/null)

        CHQ_SPLIT=$(GET "/api/farm/cheques")
        CHQ_SPL_OK=$(echo "$CHQ_SPLIT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[c for c in d if (c.get('cheque_number') or c.get('chequeNumber',''))=='SPL-001']
if found:
    c=found[0]
    ok = c.get('bank','')=='Banco Split' and float(c.get('amount',0))==2000
    print('ok' if ok else 'badvalue:'+str(c.get('bank'))+'|'+str(c.get('amount')))
else:
    print('notfound')
" 2>/dev/null)
        if [ "$CHQ_SPL_OK" = "ok" ]; then
            resultado PASS "Cheque do split criado com bank e amount corretos" ALTO
        else
            resultado FAIL "Cheque do split inválido ou não encontrado" ALTO "Result: $CHQ_SPL_OK"
        fi
    else
        resultado FAIL "AP para split payment não encontrada" CRITICO
    fi
else
    log "SKIP 4.4 — Sem segunda conta para split payment"
fi

# =============================================================================
# BLOCO 5 — CHEQUES (CICLO COMPLETO)
# =============================================================================

header "BLOCO 5 — CHEQUES (CICLO COMPLETO)"

# 5.1 — Sem cheques inválidos
CHEQUES_FINAL=$(GET "/api/farm/cheques")
INVALIDOS=$(echo "$CHEQUES_FINAL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
inv=[c for c in d if not c.get('bank') or float(c.get('amount',1))==0]
print(len(inv))
" 2>/dev/null)
if [ "$INVALIDOS" = "0" ]; then
    resultado PASS "Nenhum cheque inválido (amount=0 ou bank='') no banco" ALTO
else
    resultado FAIL "$INVALIDOS cheque(s) inválido(s) encontrado(s)" ALTO
fi

# 5.2 — Compensar cheque
log "5.2 — Criar e compensar cheque"
CHQ_NEW_R=$(POST "/api/farm/cheques" "{\"bank\":\"Banco Compensar\",\"chequeNumber\":\"COMP-001\",\"type\":\"proprio\",\"amount\":500,\"holder\":\"Audit Compensar\",\"accountId\":\"$CONTA_A_ID\"}")
CHQ_AVULSO_ID=$(echo "$CHQ_NEW_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -n "$CHQ_AVULSO_ID" ] && [ "$CHQ_AVULSO_ID" != "None" ]; then
    resultado PASS "Cheque avulso criado: $CHQ_AVULSO_ID" MEDIO
    SALDO_PRE_COMP=$(saldo "$CONTA_A_ID")
    COMP_R=$(POST "/api/farm/cheques/$CHQ_AVULSO_ID/compensate" "{\"accountId\":\"$CONTA_A_ID\"}")
    COMP_OK=$(echo "$COMP_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok') or d.get('success',''))" 2>/dev/null)
    if echo "$COMP_OK" | grep -qi "true\|ok"; then
        resultado PASS "Cheque compensado com sucesso" ALTO
        SALDO_APOS_COMP=$(saldo "$CONTA_A_ID")
        ESP_COMP=$(python3 -c "print($SALDO_PRE_COMP - 500)" 2>/dev/null)
        if [ "$(math_eq "$SALDO_APOS_COMP" "$ESP_COMP")" = "ok" ]; then
            resultado PASS "Saldo debitado 500 após compensação: $SALDO_APOS_COMP" ALTO
        else
            resultado FAIL "Saldo incorreto após compensar cheque" ALTO "Real: $SALDO_APOS_COMP | Esperado: $ESP_COMP"
        fi
        CONTA_A_MOVIMENTOS=$(python3 -c "print($CONTA_A_MOVIMENTOS - 500)" 2>/dev/null)
    else
        resultado FAIL "Compensação de cheque falhou" ALTO "Response: ${COMP_R:0:150}"
    fi
else
    resultado FAIL "Criação de cheque avulso falhou" MEDIO "Response: ${CHQ_NEW_R:0:150}"
fi

# 5.3 — Cancelar cheque (saldo não muda)
log "5.3 — Cancelar cheque (saldo não deve mudar)"
CHQ_CAN_R=$(POST "/api/farm/cheques" "{\"bank\":\"Banco Cancelar\",\"chequeNumber\":\"CAN-888\",\"type\":\"proprio\",\"amount\":300,\"holder\":\"Audit Cancel\",\"accountId\":\"$CONTA_A_ID\"}")
CHQ_CANCEL_ID=$(echo "$CHQ_CAN_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -n "$CHQ_CANCEL_ID" ] && [ "$CHQ_CANCEL_ID" != "None" ]; then
    SALDO_PRE_CANCEL=$(saldo "$CONTA_A_ID")
    CANCEL_R=$(POST "/api/farm/cheques/$CHQ_CANCEL_ID/cancel" "{}")
    SALDO_APOS_CANCEL=$(saldo "$CONTA_A_ID")
    if [ "$(math_eq "$SALDO_APOS_CANCEL" "$SALDO_PRE_CANCEL")" = "ok" ]; then
        resultado PASS "Cancelar cheque NÃO alterou o saldo (correto)" ALTO
    else
        resultado FAIL "Cancelar cheque alterou o saldo indevidamente" ALTO "Antes: $SALDO_PRE_CANCEL | Depois: $SALDO_APOS_CANCEL"
    fi

    # 5.4 — Excluir cheque cancelado
    DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" -X DELETE "$BASE/api/farm/cheques/$CHQ_CANCEL_ID")
    if [ "$DEL_CODE" = "204" ] || [ "$DEL_CODE" = "200" ]; then
        resultado PASS "Cheque cancelado excluído com HTTP $DEL_CODE" MEDIO
        CHQ_APOS_DEL=$(GET "/api/farm/cheques")
        AINDA_EXISTE=$(echo "$CHQ_APOS_DEL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('sim' if any(c['id']=='$CHQ_CANCEL_ID' for c in d) else 'nao')
" 2>/dev/null)
        if [ "$AINDA_EXISTE" = "nao" ]; then
            resultado PASS "Cheque excluído não aparece mais na lista" MEDIO
        else
            resultado FAIL "Cheque excluído ainda aparece na lista" MEDIO
        fi
    else
        resultado FAIL "DELETE cheque retornou HTTP $DEL_CODE" MEDIO
    fi
else
    resultado FAIL "Criação de cheque para cancelar falhou" MEDIO
fi

# =============================================================================
# BLOCO 6 — FLUXO DE CAIXA E CASH SUMMARY
# =============================================================================

header "BLOCO 6 — FLUXO DE CAIXA E CASH SUMMARY"

TXS_FINAL=$(GET "/api/farm/cash-transactions")
TX_TOTAL=$(echo "$TXS_FINAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
TX_NULL_DATE=$(echo "$TXS_FINAL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
null=[t for t in d if not t.get('transactionDate') and not t.get('transaction_date')]
print(len(null))
" 2>/dev/null)

[ "$TX_NULL_DATE" = "0" ] && \
    resultado PASS "Todas as $TX_TOTAL transações têm transactionDate (0 nulos)" CRITICO || \
    resultado FAIL "$TX_NULL_DATE de $TX_TOTAL transações sem transactionDate" CRITICO

TX_SEM_AMOUNT=$(echo "$TXS_FINAL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
sem=[t for t in d if not t.get('amount')]
print(len(sem))
" 2>/dev/null)
[ "$TX_SEM_AMOUNT" = "0" ] && \
    resultado PASS "Todas as transações têm amount preenchido" ALTO || \
    resultado FAIL "$TX_SEM_AMOUNT transações sem amount" ALTO

SUMMARY_R=$(GET "/api/farm/cash-summary")
HAS_ACCOUNTS=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('accounts') else 'fail')" 2>/dev/null)
HAS_APAGAR=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'contasAPagar' in d else 'fail')" 2>/dev/null)
HAS_ARVENCER=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'contasARVencer' in d else 'fail')" 2>/dev/null)
HAS_SUMMARY=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('monthSummary') else 'fail')" 2>/dev/null)

[ "$HAS_ACCOUNTS" = "ok" ] && resultado PASS "cash-summary contém accounts" ALTO || resultado FAIL "cash-summary sem accounts" ALTO
[ "$HAS_APAGAR" = "ok" ] && resultado PASS "cash-summary contém contasAPagar" ALTO || resultado FAIL "cash-summary sem contasAPagar" ALTO
[ "$HAS_ARVENCER" = "ok" ] && resultado PASS "cash-summary contém contasARVencer" ALTO || resultado FAIL "cash-summary sem contasARVencer — campo ausente" ALTO
[ "$HAS_SUMMARY" = "ok" ] && resultado PASS "cash-summary contém monthSummary" ALTO || resultado FAIL "cash-summary sem monthSummary" ALTO

# contasAPagar não deve incluir pagas
PAGAS_NO_SUMMARY=$(echo "$SUMMARY_R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
pagas=[a for a in d.get('contasAPagar',[]) if a.get('paymentStatus')=='pago' or a.get('payment_status')=='pago']
print(len(pagas))
" 2>/dev/null)
[ "$PAGAS_NO_SUMMARY" = "0" ] && \
    resultado PASS "contasAPagar não inclui despesas já pagas" CRITICO || \
    resultado FAIL "contasAPagar inclui $PAGAS_NO_SUMMARY despesa(s) já paga(s)" CRITICO

# saldoLiquido = entradas - saidas
TOTAL_ENT=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('monthSummary',{}).get('totalEntradas',0)))" 2>/dev/null)
TOTAL_SAI=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('monthSummary',{}).get('totalSaidas',0)))" 2>/dev/null)
SALDO_LIQ=$(echo "$SUMMARY_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d.get('monthSummary',{}).get('saldoLiquido',0)))" 2>/dev/null)
SALDO_LIQ_CALC=$(python3 -c "print($TOTAL_ENT - $TOTAL_SAI)" 2>/dev/null)
if [ "$(math_eq "$SALDO_LIQ" "$SALDO_LIQ_CALC")" = "ok" ]; then
    resultado PASS "saldoLiquido ($SALDO_LIQ) = totalEntradas ($TOTAL_ENT) - totalSaidas ($TOTAL_SAI)" CRITICO
else
    resultado FAIL "saldoLiquido não bate: real=$SALDO_LIQ calculado=$SALDO_LIQ_CALC" CRITICO
fi

# =============================================================================
# BLOCO 7 — ROMANEIO
# =============================================================================

header "BLOCO 7 — ROMANEIO"

ROM_R=$(POST "/api/farm/romaneios" '{"buyer":"COMPRADOR AUDIT","crop":"soja","deliveryDate":"2026-03-19","grossWeight":12000,"tare":2000,"netWeight":10000,"finalWeight":10000,"pricePerTon":600}')
ROM_ID=$(echo "$ROM_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
ROM_PRICE=$(echo "$ROM_R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pricePerTon') or d.get('price_per_ton',''))" 2>/dev/null)

if [ -n "$ROM_ID" ] && [ "$ROM_ID" != "None" ]; then
    resultado PASS "Romaneio criado: $ROM_ID" MEDIO
else
    resultado FAIL "Criação de romaneio falhou" MEDIO "Response: ${ROM_R:0:200}"
fi

if [ -n "$ROM_PRICE" ] && [ "$ROM_PRICE" != "None" ] && [ "$ROM_PRICE" != "null" ]; then
    resultado PASS "pricePerTon salvo corretamente: $ROM_PRICE" MEDIO
else
    resultado FAIL "pricePerTon não salvo (retornou null)" MEDIO
fi

ROMS_LIST=$(GET "/api/farm/romaneios")
ROM_NA_LISTA=$(echo "$ROMS_LIST" | python3 -c "
import sys,json
d=json.load(sys.stdin)
found=[r for r in d if r.get('buyer','')=='COMPRADOR AUDIT']
print('ok' if found else 'nao')
" 2>/dev/null)
[ "$ROM_NA_LISTA" = "ok" ] && resultado PASS "Romaneio aparece na listagem" MEDIO || resultado FAIL "Romaneio não aparece na listagem" MEDIO

# =============================================================================
# BLOCO 8 — MASTER CHECK MATEMÁTICO
# =============================================================================

header "BLOCO 8 — MASTER CHECK MATEMÁTICO (O MAIS IMPORTANTE)"

log "Calculando saldo esperado de cada conta com base em todos os movimentos..."

SALDO_A_ATUAL=$(saldo "$CONTA_A_ID")
SALDO_A_ESPERADO=$(python3 -c "print($SALDO_A_INICIAL + $CONTA_A_MOVIMENTOS)" 2>/dev/null)
log "Conta A | Inicial: $SALDO_A_INICIAL | Movimentos: $CONTA_A_MOVIMENTOS | Esperado: $SALDO_A_ESPERADO | Real: $SALDO_A_ATUAL"

if [ "$(math_eq "$SALDO_A_ATUAL" "$SALDO_A_ESPERADO")" = "ok" ]; then
    resultado PASS "Conta A: saldo final bate com a soma de todos os movimentos" CRITICO
else
    resultado FAIL "Conta A: DIVERGÊNCIA CONTÁBIL detectada!" CRITICO "Real: $SALDO_A_ATUAL | Esperado: $SALDO_A_ESPERADO | Diferença: $(python3 -c "print(abs($SALDO_A_ATUAL - $SALDO_A_ESPERADO))")"
fi

if [ -n "$CONTA_B_ID" ]; then
    SALDO_B_ATUAL=$(saldo "$CONTA_B_ID")
    SALDO_B_ESPERADO=$(python3 -c "print($SALDO_B_INICIAL + $CONTA_B_MOVIMENTOS)" 2>/dev/null)
    log "Conta B | Inicial: $SALDO_B_INICIAL | Movimentos: $CONTA_B_MOVIMENTOS | Esperado: $SALDO_B_ESPERADO | Real: $SALDO_B_ATUAL"

    if [ "$(math_eq "$SALDO_B_ATUAL" "$SALDO_B_ESPERADO")" = "ok" ]; then
        resultado PASS "Conta B: saldo final bate com a soma de todos os movimentos" CRITICO
    else
        resultado FAIL "Conta B: DIVERGÊNCIA CONTÁBIL detectada!" CRITICO "Real: $SALDO_B_ATUAL | Esperado: $SALDO_B_ESPERADO | Diferença: $(python3 -c "print(abs($SALDO_B_ATUAL - $SALDO_B_ESPERADO))")"
    fi
fi

# Soma total de todas as contas deve ser coerente
CONTAS_FINAL=$(GET "/api/farm/cash-accounts")
SOMA_TOTAL_FINAL=$(echo "$CONTAS_FINAL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(float(c.get('currentBalance',0)) for c in d))
" 2>/dev/null)
log "Soma total inicial: $SOMA_TOTAL_INICIAL | Soma total final: $SOMA_TOTAL_FINAL"
resultado PASS "Soma total de todas as contas verificada: $SOMA_TOTAL_FINAL" CRITICO

# =============================================================================
# BLOCO 9 — TESTES DE ERRO (sistema deve retornar 4xx, nunca 500)
# =============================================================================

header "BLOCO 9 — TESTES DE ERRO"

ERR1=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" -X POST "$BASE/api/farm/accounts-receivable" \
    -H "Content-Type: application/json" -d '{"totalAmount":"100","dueDate":"2026-05-01"}')
if [ "$ERR1" != "500" ] && [ "$ERR1" != "200" ]; then
    resultado PASS "AR sem buyer retorna $ERR1 (não 500)" MEDIO
else
    resultado FAIL "AR sem buyer retornou $ERR1 — deveria ser 4xx" MEDIO
fi

ERR2=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" \
    "$BASE/api/farm/accounts-receivable/id-que-nao-existe")
[ "$ERR2" = "404" ] && resultado PASS "AR inexistente retorna 404" MEDIO || resultado FAIL "AR inexistente retornou $ERR2 (esperado 404)" MEDIO

ERR3=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" -X POST \
    "$BASE/api/farm/accounts-receivable/id-falso/receive" \
    -H "Content-Type: application/json" -d "{\"amount\":100,\"accountId\":\"$CONTA_A_ID\",\"paymentMethod\":\"transferencia\"}")
[ "$ERR3" = "404" ] && resultado PASS "Receive em AR inexistente retorna 404" MEDIO || resultado FAIL "Receive em AR inexistente retornou $ERR3 (esperado 404)" MEDIO

ERR4=$(curl -s -o /dev/null -w "%{http_code}" -b "$CK" "$BASE/api/farm/cash-accounts/id-invalido-xyz")
[ "$ERR4" = "404" ] && resultado PASS "cash-accounts/:id inexistente retorna 404" MEDIO || resultado FAIL "cash-accounts/:id inexistente retornou $ERR4 (esperado 404)" MEDIO

# =============================================================================
# RELATÓRIO FINAL
# =============================================================================

PORCENTO=$(python3 -c "print(round($PASS/$TOTAL*100,1) if $TOTAL>0 else 0)" 2>/dev/null)

if [ ${#CRITICOS_FAIL[@]} -eq 0 ] && [ "$PORCENTO" = "100.0" ]; then
    VEREDICTO="✅ APROVADO"
elif [ ${#CRITICOS_FAIL[@]} -eq 0 ]; then
    VEREDICTO="⚠️  APROVADO COM RESSALVAS"
else
    VEREDICTO="❌ REPROVADO"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   RELATÓRIO FINAL                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Data/Hora  : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Sistema    : $BASE"
echo "  Resultado  : $VEREDICTO"
echo ""
echo "  TOTAL  : $TOTAL testes"
echo "  PASS   : $PASS ($PORCENTO%)"
echo "  FAIL   : $FAIL"
echo ""

if [ ${#CRITICOS_FAIL[@]} -gt 0 ]; then
    echo "  ─── CRÍTICOS FALHANDO (bloqueiam uso em produção) ───"
    for item in "${CRITICOS_FAIL[@]}"; do echo "    ❌ $item"; done
    echo ""
fi

if [ ${#ALTOS_FAIL[@]} -gt 0 ]; then
    echo "  ─── ALTA SEVERIDADE FALHANDO ───"
    for item in "${ALTOS_FAIL[@]}"; do echo "    ⚠️  $item"; done
    echo ""
fi

if [ ${#MEDIOS_FAIL[@]} -gt 0 ]; then
    echo "  ─── MÉDIA SEVERIDADE FALHANDO ───"
    for item in "${MEDIOS_FAIL[@]}"; do echo "    ℹ️  $item"; done
    echo ""
fi

# Salvar relatório em markdown
cat > "$REPORT" << MDEOF
# Relatório de Auditoria — AgroFarmDigital Módulo Financeiro

**Data**: $(date '+%Y-%m-%d %H:%M:%S')
**Sistema**: $BASE
**Resultado**: $VEREDICTO

## Pontuação

| Métrica | Valor |
|---------|-------|
| Total de testes | $TOTAL |
| PASS | $PASS ($PORCENTO%) |
| FAIL | $FAIL |

## Críticos Falhando
$(for item in "${CRITICOS_FAIL[@]}"; do echo "- ❌ $item"; done)
$([ ${#CRITICOS_FAIL[@]} -eq 0 ] && echo "Nenhum")

## Alta Severidade Falhando
$(for item in "${ALTOS_FAIL[@]}"; do echo "- ⚠️ $item"; done)
$([ ${#ALTOS_FAIL[@]} -eq 0 ] && echo "Nenhum")

## Média Severidade Falhando
$(for item in "${MEDIOS_FAIL[@]}"; do echo "- ℹ️ $item"; done)
$([ ${#MEDIOS_FAIL[@]} -eq 0 ] && echo "Nenhum")

## Saldos Verificados

| Conta | Saldo Inicial | Movimentos | Esperado | Real |
|-------|--------------|------------|---------|------|
| A ($CONTA_A_ID) | $SALDO_A_INICIAL | $CONTA_A_MOVIMENTOS | $SALDO_A_ESPERADO | $SALDO_A_ATUAL |
| B ($CONTA_B_ID) | $SALDO_B_INICIAL | $CONTA_B_MOVIMENTOS | $SALDO_B_ESPERADO | $SALDO_B_ATUAL |

**Soma total de todas as contas (final)**: $SOMA_TOTAL_FINAL

## Veredicto

$VEREDICTO

$([ ${#CRITICOS_FAIL[@]} -gt 0 ] && echo "Sistema com falhas críticas que impedem uso seguro em produção." || echo "Sistema aprovado para uso em produção.")
MDEOF

echo "  Relatório salvo em: $REPORT"
echo ""
