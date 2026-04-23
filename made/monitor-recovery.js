/**
 * ========================================
 * SISTEMA DE MONITOREO Y AUTO-RECUPERACIÓN
 * ========================================
 * Ejecutar: node monitor-recovery.js
 * Función: Vigilar el servidor y auto-recuperar en caso de caida
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

class Monitor {
    constructor(config = {}) {
        this.serverUrl = config.serverUrl || 'http://localhost:3000';
        this.healthCheckInterval = config.healthCheckInterval || 30000; // 30 segundos
        this.maxFailures = config.maxFailures || 3; // Máximo de fallos antes de recuperar
        this.recoveryTimeout = config.recoveryTimeout || 60000; // 1 minuto
        
        this.failureCount = 0;
        this.isRecovering = false;
        this.startTime = Date.now();
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 5;
        
        this.logsPath = path.join(__dirname, 'logs');
        this.ensureLogDirectory();
        
        this.stats = {
            checks: 0,
            failures: 0,
            recoveries: 0,
            uptime: 0,
            responseTime: 0
        };
        
        console.log(`
        ╔════════════════════════════════════════════════╗
        ║     🕵️ MONITOR Y AUTO-RECUPERACIÓN ACTIVO     ║
        ╚════════════════════════════════════════════════╝
        
        Monitoreando: ${this.serverUrl}
        Intervalo: ${this.healthCheckInterval}ms
        Máximo de fallos: ${this.maxFailures}
        Timeout de recuperación: ${this.recoveryTimeout}ms
        `);
    }

    // ========================================
    // FUNCIONES DE LOG
    // ========================================

    ensureLogDirectory() {
        if (!fs.existsSync(this.logsPath)) {
            fs.mkdirSync(this.logsPath, { recursive: true });
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}`;
        
        console.log(logMessage);
        
        // Guardar en archivo
        const logFile = path.join(this.logsPath, 'monitor.log');
        fs.appendFileSync(logFile, logMessage + '\n');
    }

    // ========================================
    // HEALTH CHECK
    // ========================================

    /**
     * Realiza un health check al servidor
     */
    async checkHealth() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const isHttps = this.serverUrl.startsWith('https');
            const protocol = isHttps ? https : http;

            const req = protocol.get(this.serverUrl + '/api/security-status', 
                { timeout: 10000 },
                (res) => {
                    const responseTime = Date.now() - startTime;
                    this.stats.responseTime = responseTime;

                    if (res.statusCode === 200) {
                        this.log(`✅ Health check OK (${responseTime}ms)`, 'SUCCESS');
                        this.failureCount = 0; // Reset
                        resolve({ healthy: true, statusCode: res.statusCode, responseTime });
                    } else {
                        this.log(`⚠️ Status code: ${res.statusCode}`, 'WARNING');
                        resolve({ healthy: false, statusCode: res.statusCode, responseTime });
                    }
                }
            );

            req.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                this.log(`❌ Health check fallido: ${error.message}`, 'ERROR');
                resolve({ healthy: false, error: error.message, responseTime });
            });

            req.on('timeout', () => {
                req.destroy();
                this.log(`⏱️ Health check timeout`, 'ERROR');
                resolve({ healthy: false, error: 'timeout' });
            });
        });
    }

    /**
     * Monitoreo continuo
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            this.stats.checks++;
            
            const health = await this.checkHealth();

            if (!health.healthy) {
                this.failureCount++;
                this.stats.failures++;

                if (this.failureCount >= this.maxFailures && !this.isRecovering) {
                    this.log(`🚨 CRÍTICO: ${this.failureCount} fallos consecutivos detectados`, 'CRITICAL');
                    this.attemptRecovery();
                }
            }

            this.stats.uptime = Date.now() - this.startTime;
        }, this.healthCheckInterval);
    }

    // ========================================
    // AUTO-RECUPERACIÓN
    // ========================================

    /**
     * Intenta recuperar el servidor
     */
    async attemptRecovery() {
        if (this.isRecovering) {
            this.log('⏳ Ya hay una recuperación en progreso', 'INFO');
            return;
        }

        this.isRecovering = true;
        this.recoveryAttempts++;
        
        this.log(`🔧 INICIANDO RECUPERACIÓN (Intento ${this.recoveryAttempts}/${this.maxRecoveryAttempts})`, 'WARNING');

        try {
            // 1. Intentar reiniciar el proceso Node.js
            this.log('→ Paso 1: Reiniciando proceso Node.js', 'INFO');
            await this.restartProcess();

            // Esperar a que se recupere
            await this.sleep(5000);

            // 2. Verificar salud
            this.log('→ Paso 2: Verificando salud del servidor', 'INFO');
            const health = await this.checkHealth();

            if (health.healthy) {
                this.log('✅ RECUPERACIÓN EXITOSA', 'SUCCESS');
                this.stats.recoveries++;
                this.failureCount = 0;
                this.recoveryAttempts = 0;
                this.isRecovering = false;
                this.sendAlert('recovery_success', 'Servidor recuperado exitosamente');
                return;
            }

            // 3. Si aún no funciona, intentar limpiar y reiniciar
            this.log('→ Paso 3: Limpieza profunda y reinicio completo', 'INFO');
            await this.deepRecovery();

            // 4. Esperar
            await this.sleep(5000);

            // 5. Verificar nuevamente
            const health2 = await this.checkHealth();
            if (health2.healthy) {
                this.log('✅ RECUPERACIÓN PROFUNDA EXITOSA', 'SUCCESS');
                this.stats.recoveries++;
                this.failureCount = 0;
                this.recoveryAttempts = 0;
                this.isRecovering = false;
                this.sendAlert('deep_recovery_success', 'Servidor recuperado con limpieza profunda');
                return;
            }

            // 6. Si sigue sin funcionar, intentar con todos los puertos
            if (this.recoveryAttempts < this.maxRecoveryAttempts) {
                this.log('→ Paso 4: Intentando liberación de puertos', 'INFO');
                await this.releasePorts();
                await this.sleep(3000);
                await this.attemptRecovery();
            } else {
                this.log('❌ FALLO EN RECUPERACIÓN - Máximo de intentos alcanzado', 'CRITICAL');
                this.sendAlert('recovery_failed', 'No se pudo recuperar el servidor después de 5 intentos');
                this.isRecovering = false;
            }

        } catch (error) {
            this.log(`❌ Error en recuperación: ${error.message}`, 'ERROR');
            this.isRecovering = false;
            
            if (this.recoveryAttempts < this.maxRecoveryAttempts) {
                this.log('⏳ Reintentando en 30 segundos...', 'INFO');
                setTimeout(() => this.attemptRecovery(), 30000);
            }
        }
    }

    /**
     * Reinicia el proceso Node.js
     */
    async restartProcess() {
        return new Promise((resolve, reject) => {
            // Intentar matar el proceso existente en el puerto
            exec(`lsof -ti:3000 | xargs kill -9`, { 
                shell: '/bin/bash',
                timeout: 5000
            }, (error) => {
                if (error && !error.message.includes('not found')) {
                    this.log(`⚠️ Error al matar proceso: ${error.message}`, 'WARNING');
                }
                
                // Iniciar nuevo proceso
                this.log('Iniciando servidor...', 'INFO');
                
                // Usar npm start si está disponible
                const child = spawn('npm', ['start'], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: __dirname
                });

                child.unref();
                resolve();
            });
        });
    }

    /**
     * Recuperación profunda
     */
    async deepRecovery() {
        return new Promise((resolve) => {
            exec(`
                # Matar todos los procesos Node.js
                pkill -f "node server"
                sleep 1
                
                # Liberar puerto
                fuser -k 3000/tcp 2>/dev/null || true
                sleep 1
                
                # Limpiar cache
                rm -rf node_modules/.cache
                
                # Reiniciar
                cd ${__dirname}
                npm start &
            `, { shell: '/bin/bash', timeout: 15000 }, (error) => {
                if (error) {
                    this.log(`⚠️ Error en deep recovery: ${error.message}`, 'WARNING');
                }
                resolve();
            });
        });
    }

    /**
     * Libera puertos bloqueados
     */
    async releasePorts() {
        return new Promise((resolve) => {
            const ports = [3000, 8080, 8443];
            let released = 0;

            ports.forEach(port => {
                exec(`fuser -k ${port}/tcp`, { shell: '/bin/bash' }, (error) => {
                    if (!error) {
                        this.log(`Liberado puerto ${port}`, 'INFO');
                    }
                    released++;
                    if (released === ports.length) resolve();
                });
            });
        });
    }

    // ========================================
    // UTILIDADES
    // ========================================

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Envía alerta a administrador
     */
    sendAlert(type, message) {
        const alert = {
            type,
            message,
            timestamp: new Date().toISOString(),
            stats: this.stats
        };

        this.log(`📢 ALERTA: ${message}`, 'ALERT');
        
        // Aquí integrar con email, Slack, etc.
        // webhook('https://hooks.slack.com/...', alert);
    }

    /**
     * Obtiene estadísticas
     */
    getStats() {
        return {
            ...this.stats,
            failureCount: this.failureCount,
            recoveryAttempts: this.recoveryAttempts,
            isRecovering: this.isRecovering,
            uptime: this.formatUptime(this.stats.uptime),
            lastCheck: new Date().toISOString()
        };
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Stop del monitor
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.log('Monitor detenido', 'INFO');
        }
    }
}

// ========================================
// APLICACIÓN PRINCIPAL
// ========================================

const monitor = new Monitor({
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    healthCheckInterval: 30000,
    maxFailures: 3
});

// Iniciar monitoreo
monitor.startMonitoring();

// Endpoint HTTP para monitoreo (Puerto 3001)
const http2 = require('http');
http2.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/stats') {
        res.writeHead(200);
        res.end(JSON.stringify(monitor.getStats(), null, 2));
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'Monitor is running',
            stats: monitor.getStats()
        }, null, 2));
    }
}).listen(3001, () => {
    monitor.log('Monitor HTTP server escuchando en puerto 3001', 'INFO');
});

// Manejo de señales
process.on('SIGINT', () => {
    console.log('\n\n✅ Monitor apagándose...');
    monitor.stop();
    process.exit(0);
});

module.exports = Monitor;
