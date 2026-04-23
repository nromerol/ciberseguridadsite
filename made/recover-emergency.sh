#!/bin/bash

# ========================================
# SCRIPT DE RECUPERACIÓN TOTAL DE EMERGENCIA
# ========================================
# Uso: sudo bash recover-emergency.sh
# Función: Recuperar completamente el sitio en caso de ataque severo

echo "╔════════════════════════════════════════════════╗"
echo "║   🚨 PROCEDIMIENTO DE RECUPERACIÓN TOTAL      ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Verificar permisos
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script requiere permisos de root (sudo)"
    exit 1
fi

# ========================================
# PASO 1: DETENER TODO
# ========================================

echo "═ PASO 1: Deteniendo servicios ═"
echo ""

echo "Matando procesos Node.js..."
pkill -f "node server"
pkill -f "node monitor"
pkill -f "pm2"

echo "Deteniendo Docker Compose..."
docker-compose down 2>/dev/null

echo "Deteniendo Docker si es necesario..."
docker stop $(docker ps -q) 2>/dev/null

sleep 2
echo "✅ Servicios detenidos"
echo ""

# ========================================
# PASO 2: LIMPIAR PUERTOS
# ========================================

echo "═ PASO 2: Liberando puertos ═"
echo ""

PORTS=(3000 3001 3002 3003 3005 3101 3102 3103 8080 8443)

for PORT in "${PORTS[@]}"; do
    echo "Liberando puerto $PORT..."
    fuser -k $PORT/tcp 2>/dev/null || true
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
done

sleep 2
echo "✅ Puertos liberados"
echo ""

# ========================================
# PASO 3: LIMPIAR ARCHIVOS TEMPORALES
# ========================================

echo "═ PASO 3: Limpiando archivos temporales ═"
echo ""

echo "Limpiando node_modules/.cache..."
rm -rf node_modules/.cache
rm -rf node_modules/.bin

echo "Limpiando logs antiguos..."
find logs -name "*.log" -mtime +7 -delete
find logs -name "*.log" -size +100M -delete

echo "Limpiando Docker..."
docker system prune -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

echo "✅ Archivos temporales limpiados"
echo ""

# ========================================
# PASO 4: REINSTALAR DEPENDENCIAS
# ========================================

echo "═ PASO 4: Reinstalando dependencias ═"
echo ""

echo "Eliminando node_modules..."
rm -rf node_modules

echo "Limpiando cache de npm..."
npm cache clean --force

echo "Reinstalando paquetes..."
npm install --production

echo "✅ Dependencias reinstaladas"
echo ""

# ========================================
# PASO 5: VERIFICAR INTEGRIDAD
# ========================================

echo "═ PASO 5: Verificando integridad ═"
echo ""

echo "Verificando archivos críticos..."

CRITICAL_FILES=(
    "server-secure.js"
    "monitor-recovery.js"
    "package.json"
    "index.html"
    "assets/js/security.js"
)

MISSING=0
for FILE in "${CRITICAL_FILES[@]}"; do
    if [ -f "$FILE" ]; then
        echo "✅ $FILE presente"
    else
        echo "❌ $FILE FALTANTE"
        ((MISSING++))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo ""
    echo "❌ Faltan archivos críticos - Restaurando desde backup..."
    
    LATEST_BACKUP=$(ls -t backups/backup-*.tar.gz 2>/dev/null | head -1)
    if [ -f "$LATEST_BACKUP" ]; then
        tar -xzf "$LATEST_BACKUP"
        echo "✅ Restaurado desde: $LATEST_BACKUP"
    else
        echo "❌ No hay backups disponibles"
        exit 1
    fi
fi

echo "✅ Integridad verificada"
echo ""

# ========================================
# PASO 6: CONFIGURAR FIREWALL
# ========================================

echo "═ PASO 6: Configurando firewall ═"
echo ""

echo "Aplicando reglas iptables básicas..."
bash firewall-rules.sh

echo "✅ Firewall configurado"
echo ""

# ========================================
# PASO 7: INICIAR SERVICIOS
# ========================================

echo "═ PASO 7: Iniciando servicios ═"
echo ""

# Crear directorios
mkdir -p logs
mkdir -p backups

# Iniciar con Docker si está disponible
if command -v docker-compose &> /dev/null; then
    echo "Iniciando Docker Compose..."
    docker-compose up -d
    sleep 10
else
    echo "Iniciando con PM2..."
    npm install -g pm2
    pm2 delete all 2>/dev/null
    pm2 start ecosystem.config.json
    pm2 save
    pm2 startup
fi

echo "✅ Servicios iniciados"
echo ""

# ========================================
# PASO 8: VERIFICAR RECUPERACIÓN
# ========================================

echo "═ PASO 8: Verificando recuperación ═"
echo ""

echo "Esperando que el servidor esté listo..."
sleep 10

MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Intento $ATTEMPT/$MAX_ATTEMPTS..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/security-status 2>/dev/null)
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo "✅ Servidor respondiendo (HTTP $HTTP_CODE)"
        break
    else
        echo "⏳ Esperando... (HTTP $HTTP_CODE)"
        ((ATTEMPT++))
        sleep 2
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ El servidor no responde después de $MAX_ATTEMPTS intentos"
    echo ""
    echo "Logs de error:"
    docker-compose logs app-1 2>/dev/null | tail -20
    pm2 logs 2>/dev/null | tail -20
    exit 1
fi

echo ""
echo "✅ Verificación completada exitosamente"
echo ""

# ========================================
# PASO 9: REPORT FINAL
# ========================================

echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ RECUPERACIÓN COMPLETADA EXITOSAMENTE     ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

echo "📊 Estado del sistema:"
echo ""

# Mostrar estado de servicios
if command -v docker-compose &> /dev/null; then
    echo "Docker Compose:"
    docker-compose ps
    echo ""
else
    echo "PM2:"
    pm2 list
    echo ""
fi

echo "📝 Próximas acciones recomendadas:"
echo "   1. Revisar archivo SECURITY-GUIDE.md"
echo "   2. Analizar logs de ataque:"
echo "      - tail -f logs/monitor.log"
echo "      - tail -f logs/alerts.log"
echo "   3. Verificar IPs bloqueadas:"
echo "      - cat logs/blocked-ips.json"
echo "   4. Ejecutar verificación de seguridad:"
echo "      - bash verify-security.sh"
echo ""

# Backup después de recuperación
echo "💾 Creando backup de post-recuperación..."
BACKUP_FILE="backups/backup-recovery-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=backups \
    .

echo "✅ Backup guardado en: $BACKUP_FILE"
echo ""

echo "Sitio disponible en: http://localhost:3000"
echo "Timestamp: $(date)"
echo ""
