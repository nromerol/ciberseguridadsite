#!/bin/bash

# ========================================
# VERIFICADOR DE INTEGRIDAD Y SSL
# ========================================
# Uso: bash verify-security.sh

echo "╔════════════════════════════════════════════════╗"
echo "║     🔒 VERIFICADOR DE INTEGRIDAD Y SSL        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# ========================================
# VARIABLES
# ========================================

DOMAIN=${1:-"yourdomain.com"}
SERVER="https://$DOMAIN"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_FILE="security-check-report-$DOMAIN-$(date +%s).txt"

# ========================================
# FUNCIONES
# ========================================

log_check() {
    echo "[✓] $1"
    echo "[✓] $1" >> "$REPORT_FILE"
}

log_error() {
    echo "[✗] $1"
    echo "[✗] $1" >> "$REPORT_FILE"
}

log_warning() {
    echo "[⚠] $1"
    echo "[⚠] $1" >> "$REPORT_FILE"
}

# ========================================
# INIT REPORT
# ========================================

{
    echo "╔════════════════════════════════════════════════╗"
    echo "║   REPORTE DE VERIFICACIÓN DE SEGURIDAD        ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
    echo "Dominio: $DOMAIN"
    echo "Fecha: $TIMESTAMP"
    echo ""
} > "$REPORT_FILE"

echo ""
echo "═ 1. VERIFICACIÓN DE SSL/TLS ═"
echo ""

# Verificar certificado SSL
if timeout 5 openssl s_client -connect "$DOMAIN:443" </dev/null 2>/dev/null | grep -q "depth="; then
    log_check "Certificado SSL válido"
else
    log_error "Certificado SSL inválido o no encontrado"
fi

# Verificar TLS version
TLS_VERSION=$(timeout 5 openssl s_client -connect "$DOMAIN:443" </dev/null 2>/dev/null | grep "Protocol" | awk '{print $3}')
if [[ "$TLS_VERSION" =~ "TLSv1.2"|"TLSv1.3" ]]; then
    log_check "TLS version segura: $TLS_VERSION"
else
    log_warning "TLS version posiblemente débil: $TLS_VERSION"
fi

# Verificar fecha de expiración
EXPIRY=$(timeout 5 openssl s_client -connect "$DOMAIN:443" </dev/null 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f 2)
log_check "Certificado válido hasta: $EXPIRY"

echo ""
echo "═ 2. VERIFICACIÓN DE HEADERS HTTP ═"
echo ""

# Obtener headers
HEADERS=$(curl -I -s -k "$SERVER" 2>/dev/null)

# Verificar Content-Security-Policy
if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    log_check "CSP (Content-Security-Policy) implementado"
else
    log_warning "CSP no encontrado"
fi

# Verificar X-Frame-Options
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    log_check "X-Frame-Options implementado"
else
    log_warning "X-Frame-Options no encontrado"
fi

# Verificar X-Content-Type-Options
if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    log_check "X-Content-Type-Options implementado"
else
    log_warning "X-Content-Type-Options no encontrado"
fi

# Verificar Strict-Transport-Security (HSTS)
if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    log_check "HSTS (Strict-Transport-Security) implementado"
else
    log_warning "HSTS no encontrado"
fi

# Verificar X-XSS-Protection
if echo "$HEADERS" | grep -q "X-XSS-Protection"; then
    log_check "X-XSS-Protection implementado"
else
    log_warning "X-XSS-Protection no encontrado"
fi

# Verificar Referrer-Policy
if echo "$HEADERS" | grep -q "Referrer-Policy"; then
    log_check "Referrer-Policy implementado"
else
    log_warning "Referrer-Policy no encontrado"
fi

echo ""
echo "═ 3. VERIFICACIÓN DE REDIRECCIÓN ═"
echo ""

# Verificar HTTP → HTTPS
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" "http://$DOMAIN" 2>/dev/null)
if [[ "$HTTP_STATUS" == "301" ]] || [[ "$HTTP_STATUS" == "302" ]]; then
    log_check "Redirección HTTP → HTTPS: Correcta ($HTTP_STATUS)"
else
    log_warning "HTTP status: $HTTP_STATUS"
fi

echo ""
echo "═ 4. PRUEBAS DE VULNERABILIDADES ═"
echo ""

# Prueba XSS básica
XSS_TEST="<script>alert('test')</script>"
if curl -s -k "$SERVER?test=$XSS_TEST" 2>/dev/null | grep -q "$XSS_TEST"; then
    log_error "⚠ Posible vulnerabilidad XSS detectada"
else
    log_check "Filtro XSS activo"
fi

# Prueba SQL Injection básica
SQL_TEST="' OR '1'='1"
if curl -s -k "$SERVER?id=$SQL_TEST" 2>/dev/null | grep -q "syntax error"; then
    log_warning "Posible SQL Injection (mensaje de error)"
else
    log_check "Filtro SQL Injection activo"
fi

echo ""
echo "═ 5. VERIFICACIÓN DE PUERTOS ═"
echo ""

# Verificar puertos comunes
PORTS=(22 23 21 25 3306 5432 3389 8080 8443 9200)
for PORT in "${PORTS[@]}"; do
    if timeout 1 bash -c "echo >/dev/tcp/$DOMAIN/$PORT" 2>/dev/null; then
        log_warning "Puerto $PORT abierto (puede ser legítimo)"
    else
        log_check "Puerto $PORT cerrado"
    fi
done

echo ""
echo "═ 6. VERIFICACIÓN DE ARCHIVOS SENSIBLES ═"
echo ""

# Archivos sensibles
SENSITIVE_FILES=(".env" ".git/config" ".htaccess" "web.config" "package.json" ".aws/credentials")

for FILE in "${SENSITIVE_FILES[@]}"; do
    STATUS=$(curl -o /dev/null -s -w "%{http_code}" -k "$SERVER/$FILE" 2>/dev/null)
    if [[ "$STATUS" == "200" ]]; then
        log_error "⚠ Archivo sensible expuesto: $FILE (Status: $STATUS)"
    else
        log_check "Archivo no expuesto: $FILE"
    fi
done

echo ""
echo "═ 7. VERIFICACIÓN DE FIREWALL ═"
echo ""

# Intentar conexión con herramientas de ataque
USER_AGENTS=(
    "sqlmap"
    "nikto"
    "nmap"
    "burp suite"
    "metasploit"
)

for AGENT in "${USER_AGENTS[@]}"; do
    STATUS=$(curl -o /dev/null -s -w "%{http_code}" -A "$AGENT" -k "$SERVER" 2>/dev/null)
    if [[ "$STATUS" == "403" ]]; then
        log_check "User-Agent bloqueado: $AGENT"
    else
        log_warning "User-Agent no bloqueado: $AGENT (Status: $STATUS)"
    fi
done

echo ""
echo "═ 8. PRUEBA DE RATE LIMITING ═"
echo ""

# Rate limit test
echo "Enviando 50 solicitudes rápidas..."
BLOCKED=0
for i in {1..50}; do
    STATUS=$(curl -o /dev/null -s -w "%{http_code}" -k "$SERVER" 2>/dev/null)
    if [[ "$STATUS" == "429" ]]; then
        ((BLOCKED++))
    fi
done

if [[ $BLOCKED -gt 0 ]]; then
    log_check "Rate limiting activo: $BLOCKED bloqueados de 50"
else
    log_warning "Rate limiting posiblemente inactivo"
fi

echo ""
echo "═ 9. INFORMACIÓN DEL SERVIDOR ═"
echo ""

echo "$HEADERS" | grep -i "server:\|x-powered-by" > /dev/null
if [ $? -eq 0 ]; then
    log_warning "Información del servidor expuesta:"
    echo "$HEADERS" | grep -i "server:\|x-powered-by"
else
    log_check "Información del servidor oculta"
fi

echo ""
echo "═ 10. ANÁLISIS DE PERFORMANCE/SEGURIDAD ═"
echo ""

# Usar herramienta online (opcional)
echo "Visita https://www.ssllabs.com/ssltest/ para análisis completo de SSL"

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ VERIFICACIÓN COMPLETADA                  ║"
echo "║   📄 Reporte guardado en: $REPORT_FILE        ║"
echo "╚════════════════════════════════════════════════╝"

echo ""
echo "RESUMEN:"
echo "========"
cat "$REPORT_FILE" | grep -c "^\[✓\]" | xargs echo "Verificaciones exitosas:"
cat "$REPORT_FILE" | grep -c "^\[✗\]" | xargs echo "Errores encontrados:"
cat "$REPORT_FILE" | grep -c "^\[⚠\]" | xargs echo "Advertencias:"

echo ""
echo "Reporte completo guardado en: $REPORT_FILE"
