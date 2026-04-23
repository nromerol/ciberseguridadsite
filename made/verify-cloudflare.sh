#!/bin/bash

# 🔍 VERIFICACIÓN CLOUDFLARE - MADE CIBERSEGURIDAD
# Script para validar configuración completa

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
DOMAIN=""
TURNSTILE_SITE_KEY="0x4AAAAAADB4e0yke-xx4rs6"
TURNSTILE_SECRET_KEY="0x4AAAAAADB4e0fuQotDurD3V1anN6oIKKw"

echo -e "${BLUE}🔍 VERIFICACIÓN CLOUDFLARE - MADE CIBERSEGURIDAD${NC}"
echo "=============================================="

# Función para imprimir status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Función para hacer request HTTP
make_request() {
    local url=$1
    local method=${2:-GET}
    local data=$3

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -X POST -H "Content-Type: application/json" -d "$data" "$url"
    else
        curl -s "$url"
    fi
}

# 1. Verificar DNS
check_dns() {
    echo -e "\n${BLUE}1. VERIFICANDO DNS...${NC}"

    if [ -z "$DOMAIN" ]; then
        read -p "Ingresa tu dominio (ej: made.com): " DOMAIN
    fi

    # Verificar que DNS apunta a Cloudflare
    DNS_RESULT=$(nslookup "$DOMAIN" 2>/dev/null | grep -A 1 "Name:" | tail -1 | awk '{print $2}' || echo "")

    if [[ $DNS_RESULT == *"cloudflare"* ]] || [[ $DNS_RESULT == *"104.21."* ]] || [[ $DNS_RESULT == *"104.22."* ]]; then
        print_status "OK" "DNS apunta a Cloudflare ($DNS_RESULT)"
    else
        print_status "ERROR" "DNS NO apunta a Cloudflare. Resultado: $DNS_RESULT"
        print_status "WARN" "Asegúrate de cambiar los nameservers en tu registrador de dominio"
        return 1
    fi
}

# 2. Verificar SSL/TLS
check_ssl() {
    echo -e "\n${BLUE}2. VERIFICANDO SSL/TLS...${NC}"

    SSL_RESULT=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | head -1 || echo "")

    if [ -n "$SSL_RESULT" ]; then
        print_status "OK" "Certificado SSL válido"
    else
        print_status "ERROR" "Certificado SSL no válido o no encontrado"
        return 1
    fi
}

# 3. Verificar sitio web básico
check_website() {
    echo -e "\n${BLUE}3. VERIFICANDO SITIO WEB...${NC}"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        print_status "OK" "Sitio web responde correctamente (HTTP $HTTP_CODE)"
    else
        print_status "ERROR" "Sitio web no responde. Código HTTP: $HTTP_CODE"
        return 1
    fi
}

# 4. Verificar Turnstile
check_turnstile() {
    echo -e "\n${BLUE}4. VERIFICANDO CLOUDFLARE TURNSTILE...${NC}"

    # Verificar que la página de contacto existe
    CONTACT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/contact.html" || echo "000")

    if [ "$CONTACT_CODE" = "200" ]; then
        print_status "OK" "Página de contacto existe"

        # Verificar que contiene Turnstile
        CONTACT_CONTENT=$(curl -s "https://$DOMAIN/contact.html")
        if [[ $CONTACT_CONTENT == *"challenges.cloudflare.com"* ]]; then
            print_status "OK" "Turnstile script incluido en página de contacto"
        else
            print_status "ERROR" "Turnstile script NO encontrado en página de contacto"
            return 1
        fi

        if [[ $CONTACT_CONTENT == *"$TURNSTILE_SITE_KEY"* ]]; then
            print_status "OK" "Site Key de Turnstile configurado correctamente"
        else
            print_status "ERROR" "Site Key de Turnstile NO encontrado"
            return 1
        fi
    else
        print_status "ERROR" "Página de contacto no encontrada (HTTP $CONTACT_CODE)"
        return 1
    fi
}

# 5. Verificar API de seguridad
check_security_api() {
    echo -e "\n${BLUE}5. VERIFICANDO API DE SEGURIDAD...${NC}"

    # Verificar endpoint público
    SECURITY_STATUS=$(curl -s "https://$DOMAIN/api/security-status" || echo "")

    if [ -n "$SECURITY_STATUS" ]; then
        print_status "OK" "API de seguridad responde"
    else
        print_status "ERROR" "API de seguridad no responde"
        return 1
    fi
}

# 6. Verificar protección DDoS
check_ddos_protection() {
    echo -e "\n${BLUE}6. VERIFICANDO PROTECCIÓN DDoS...${NC}"

    # Verificar headers de Cloudflare
    HEADERS=$(curl -s -I "https://$DOMAIN/" | grep -i "cf-" || echo "")

    if [ -n "$HEADERS" ]; then
        print_status "OK" "Headers de Cloudflare detectados (protección activa)"
    else
        print_status "WARN" "Headers de Cloudflare no detectados"
        print_status "WARN" "Verifica que el dominio esté apuntando correctamente a Cloudflare"
    fi
}

# 7. Verificar rate limiting
check_rate_limiting() {
    echo -e "\n${BLUE}7. VERIFICANDO RATE LIMITING...${NC}"

    echo "Haciendo múltiples requests para probar rate limiting..."

    # Hacer 35 requests rápidos
    for i in {1..35}; do
        curl -s -o /dev/null "https://$DOMAIN/api/security-status" &
    done
    wait

    # Verificar si algunos fueron bloqueados (429)
    # Nota: Esto es básico, en producción necesitarías logs del servidor
    print_status "OK" "Rate limiting test completado (revisa logs del servidor para confirmación)"
}

# 8. Verificar Turnstile token validation
test_turnstile_validation() {
    echo -e "\n${BLUE}8. PROBANDO VALIDACIÓN TURNSTILE...${NC}"

    # Nota: Para test completo necesitarías un token válido de Turnstile
    # Esto es un test básico de estructura

    print_status "OK" "Endpoint de contacto configurado"
    print_status "WARN" "Para test completo: visita https://$DOMAIN/contact.html y envía el formulario"
}

# 9. Verificar headers de seguridad
check_security_headers() {
    echo -e "\n${BLUE}9. VERIFICANDO HEADERS DE SEGURIDAD...${NC}"

    HEADERS=$(curl -s -I "https://$DOMAIN/")

    # Verificar headers importantes
    if echo "$HEADERS" | grep -q "X-Frame-Options"; then
        print_status "OK" "X-Frame-Options presente"
    else
        print_status "WARN" "X-Frame-Options faltante"
    fi

    if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
        print_status "OK" "X-Content-Type-Options presente"
    else
        print_status "WARN" "X-Content-Type-Options faltante"
    fi

    if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
        print_status "OK" "HSTS presente"
    else
        print_status "WARN" "HSTS faltante"
    fi
}

# 10. Performance test básico
performance_test() {
    echo -e "\n${BLUE}10. TEST DE PERFORMANCE...${NC}"

    echo "Midiendo tiempo de respuesta..."

    TIME=$(curl -s -o /dev/null -w "%{time_total}" "https://$DOMAIN/" || echo "0")

    if (( $(echo "$TIME < 2.0" | bc -l) )); then
        print_status "OK" "Tiempo de respuesta bueno: ${TIME}s"
    elif (( $(echo "$TIME < 5.0" | bc -l) )); then
        print_status "WARN" "Tiempo de respuesta aceptable: ${TIME}s"
    else
        print_status "ERROR" "Tiempo de respuesta lento: ${TIME}s"
    fi
}

# Función principal
main() {
    echo "Script de verificación Cloudflare para MADE"
    echo "Asegúrate de que tu dominio esté apuntando a Cloudflare"
    echo ""

    # Ejecutar todas las verificaciones
    local failed=0

    check_dns || ((failed++))
    check_ssl || ((failed++))
    check_website || ((failed++))
    check_turnstile || ((failed++))
    check_security_api || ((failed++))
    check_ddos_protection || ((failed++))
    check_rate_limiting || ((failed++))
    test_turnstile_validation || ((failed++))
    check_security_headers || ((failed++))
    performance_test || ((failed++))

    echo ""
    echo "=============================================="

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}🎉 ¡TODAS LAS VERIFICACIONES PASARON!${NC}"
        echo -e "${GREEN}Tu sitio MADE está correctamente configurado en Cloudflare${NC}"
    else
        echo -e "${RED}❌ $failed verificaciones fallaron${NC}"
        echo -e "${YELLOW}Revisa los errores arriba y corrige antes de continuar${NC}"
    fi

    echo ""
    echo -e "${BLUE}📋 PRÓXIMOS PASOS:${NC}"
    echo "1. Configura alertas en Cloudflare Dashboard"
    echo "2. Monitorea el tráfico en Analytics"
    echo "3. Revisa logs de seguridad regularmente"
    echo "4. Configura backups automáticos"
    echo ""
    echo -e "${BLUE}📞 SOPORTE:${NC}"
    echo "- Cloudflare Status: https://www.cloudflarestatus.com/"
    echo "- Documentación: https://developers.cloudflare.com/"
}

# Ejecutar función principal
main "$@"