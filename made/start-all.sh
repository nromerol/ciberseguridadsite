#!/bin/bash

# ========================================
# SCRIPT DE INICIO - MADE SEGURO
# ========================================
# Uso: bash start-all.sh

echo "╔════════════════════════════════════════════════╗"
echo "║         🚀 INICIANDO SISTEMA SEGURO           ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Verificar dependencias
echo "🔍 Verificando dependencias..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 Instalando PM2..."
    npm install -g pm2
fi

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker no está instalado - Se ejecutará modo standalone"
    DOCKER_AVAILABLE=false
else
    DOCKER_AVAILABLE=true
fi

echo "✅ Dependencias verificadas"
echo ""

# Crear directorios necesarios
mkdir -p logs
mkdir -p backups

# Instalar dependencias de npm
echo "📦 Instalando dependencias..."
npm install

echo ""

# Opciones
echo "Selecciona el modo de ejecución:"
echo "1) Docker Compose (Recomendado - Alta disponibilidad)"
echo "2) PM2 standalone (Sin Docker)"
echo "3) Node.js directo (Solo desarrollo)"
echo ""
read -p "Opción: " option

case $option in
    1)
        if [ "$DOCKER_AVAILABLE" = false ]; then
            echo "❌ Docker no está disponible"
            exit 1
        fi
        
        echo ""
        echo "🐳 Iniciando Docker Compose..."
        echo ""
        
        docker-compose up -d
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Docker Compose iniciado exitosamente"
            echo ""
            echo "📊 URLs de acceso:"
            echo "   👉 Sitio principal:     http://localhost"
            echo "   📈 Prometheus:          http://localhost:9090"
            echo "   📊 Grafana:             http://localhost:3005"
            echo "   🕵️  Monitor Instancia 1: http://localhost:3101/stats"
            echo "   🕵️  Monitor Instancia 2: http://localhost:3102/stats"
            echo "   🕵️  Monitor Instancia 3: http://localhost:3103/stats"
            echo ""
            echo "Ver logs:"
            echo "   docker-compose logs -f nginx"
            echo "   docker-compose logs -f app-1"
            echo ""
        else
            echo "❌ Error al iniciar Docker Compose"
            exit 1
        fi
        ;;
    
    2)
        echo ""
        echo "🔄 Iniciando PM2..."
        echo ""
        
        # Matar procesos anteriores
        pm2 delete all 2>/dev/null
        sleep 2
        
        # Iniciar con PM2
        pm2 start ecosystem.config.json
        pm2 save
        pm2 startup
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ PM2 iniciado exitosamente"
            echo ""
            echo "📊 URLs de acceso:"
            echo "   👉 Sitio principal: http://localhost:3000"
            echo "   🕵️  Monitor:        http://localhost:3001"
            echo ""
            echo "Ver procesos:"
            echo "   pm2 list"
            echo ""
            echo "Ver logs:"
            echo "   pm2 logs"
            echo ""
        else
            echo "❌ Error al iniciar PM2"
            exit 1
        fi
        ;;
    
    3)
        echo ""
        echo "⚡ Iniciando Node.js directo..."
        echo ""
        
        # Iniciar servidor en background
        node server-secure.js &
        SERVER_PID=$!
        
        # Iniciar monitor
        node monitor-recovery.js &
        MONITOR_PID=$!
        
        echo ""
        echo "✅ Servidores iniciados"
        echo ""
        echo "📊 URLs de acceso:"
        echo "   👉 Sitio principal: http://localhost:3000"
        echo "   🕵️  Monitor:        http://localhost:3001"
        echo ""
        echo "PIDs: $SERVER_PID (servidor), $MONITOR_PID (monitor)"
        echo ""
        echo "Para detener: kill $SERVER_PID $MONITOR_PID"
        echo ""
        ;;
    
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo "╔════════════════════════════════════════════════╗"
echo "║  ✅ SISTEMA INICIADO - MONITOREANDO...        ║"
echo "╚════════════════════════════════════════════════╝"
