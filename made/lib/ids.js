/**
 * ========================================
 * INTRUSION DETECTION SYSTEM (IDS)
 * ========================================
 * Detecta y bloquea intentos de ataque
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class IDS {
    constructor() {
        this.blockedIPs = new Set();
        this.suspiciousActivity = new Map();
        this.threatDatabase = this.initThreatDatabase();
        this.alertLog = [];
        this.logsPath = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
    }

    // ========================================
    // INICIALIZACIÓN
    // ========================================

    initThreatDatabase() {
        return {
            // Herramientas de ataque detectadas por User-Agent
            tools: [
                /burp|burpsuite/i,
                /nmap|zenmap/i,
                /nikto/i,
                /sqlmap/i,
                /masscan/i,
                /nessus/i,
                /openvas/i,
                /metasploit/i,
                /acunetix/i,
                /dirbuster/i,
                /zaproxy/i,
                /havij/i,
                /webscarab/i,
                /httprobe/i,
                /hydra/i,
                /wfuzz/i,
                /gobuster/i,
                /ffuf/i,
                /amass/i,
                /subfinder/i
            ],

            // Patrones de SQL Injection
            sqlInjection: [
                /union.*select|select.*from/i,
                /insert.*into|delete.*from/i,
                /drop.*table|update.*set/i,
                /exec|execute|xp_|sp_/i,
                /;.*--|\/\*/i,
                /'\s*or\s*'1'='1/i,
                /'\s*or\s*1=1/i,
                /'\s*or\s*true/i
            ],

            // Patrones de Command Injection
            commandInjection: [
                /[;&|`$(){}]/,
                /cat\s+|ls\s+|wget\s+|curl\s+|nc\s+/i,
                /bash|sh|cmd|powershell/i,
                /\/bin\/|\/usr\/bin\//i
            ],

            // Patrones de XSS
            xss: [
                /<script[^>]*>/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /<iframe|<embed|<object/i,
                /eval\s*\(|expression\s*\(/i
            ],

            // Patrones de Path Traversal
            pathTraversal: [
                /\.\.\/|\.\.\\|%2e%2e/,
                /\/etc\/passwd|\/windows\/system32/i
            ],

            // Patrones de DNS Rebinding
            dnsRebinding: [
                /127\.0\.0\.1|localhost|0\.0\.0\.0/
            ],

            // Métodos HTTP sospechosos
            suspiciousMethods: ['TRACE', 'CONNECT', 'DEBUG'],

            // Custom headers sospechosos
            suspiciousHeaders: [
                'x-scanner',
                'x-nmap',
                'x-burp',
                'x-nikto'
            ]
        };
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logsPath)) {
            fs.mkdirSync(this.logsPath, { recursive: true });
        }
    }

    // ========================================
    // ANÁLISIS DE SOLICITUDES
    // ========================================

    /**
     * Analiza una solicitud HTTP
     */
    analyzeRequest(req) {
        const threats = [];

        // 1. Verificar User-Agent
        const userAgentThreat = this.detectAttackTool(req.headers['user-agent']);
        if (userAgentThreat) {
            threats.push({
                type: 'ATTACK_TOOL_DETECTED',
                severity: 'CRITICAL',
                detail: userAgentThreat,
                source: 'user-agent'
            });
        }

        // 2. Verificar inyecciones en query/body
        const injectionThreat = this.detectInjectionAttacks(req);
        if (injectionThreat) {
            threats.push(injectionThreat);
        }

        // 3. Verificar DNS attacks
        const dnsThreat = this.detectDNSAttacks(req);
        if (dnsThreat) {
            threats.push(dnsThreat);
        }

        // 4. Verificar acceso a archivos sensibles
        const fileThreat = this.detectSensitiveFileAccess(req.path);
        if (fileThreat) {
            threats.push(fileThreat);
        }

        // 5. Verificar comportamiento anómalo
        const anomalyThreat = this.detectAnomaly(req);
        if (anomalyThreat) {
            threats.push(anomalyThreat);
        }

        // 6. Verificar patrones de fuerza bruta
        const bruteForceThreat = this.detectBruteForce(req);
        if (bruteForceThreat) {
            threats.push(bruteForceThreat);
        }

        return threats;
    }

    /**
     * Detecta herramientas de ataque por User-Agent
     */
    detectAttackTool(userAgent) {
        if (!userAgent) {
            return { tool: 'EMPTY_USER_AGENT', confidence: 0.8 };
        }

        const userAgentLower = userAgent.toLowerCase();

        for (const pattern of this.threatDatabase.tools) {
            if (pattern.test(userAgent)) {
                return {
                    tool: pattern.toString(),
                    confidence: 0.95,
                    value: userAgent
                };
            }
        }

        // Detectar User-Agents genéricos sospechosos
        if (userAgentLower === 'python' || userAgentLower === 'curl' || 
            userAgentLower === 'wget' || userAgentLower === 'perl') {
            return { tool: 'GENERIC_TOOL', confidence: 0.7, value: userAgent };
        }

        return null;
    }

    /**
     * Detecta ataques de inyección
     */
    detectInjectionAttacks(req) {
        const params = { ...req.query, ...req.body };

        for (const key in params) {
            const value = params[key];
            if (typeof value !== 'string') continue;

            // SQL Injection
            for (const pattern of this.threatDatabase.sqlInjection) {
                if (pattern.test(value)) {
                    return {
                        type: 'SQL_INJECTION',
                        severity: 'CRITICAL',
                        detail: `Detectado en: ${key}`,
                        sample: value.substring(0, 100)
                    };
                }
            }

            // Command Injection
            for (const pattern of this.threatDatabase.commandInjection) {
                if (pattern.test(value)) {
                    return {
                        type: 'COMMAND_INJECTION',
                        severity: 'CRITICAL',
                        detail: `Detectado en: ${key}`,
                        sample: value.substring(0, 100)
                    };
                }
            }

            // XSS
            for (const pattern of this.threatDatabase.xss) {
                if (pattern.test(value)) {
                    return {
                        type: 'XSS_ATTACK',
                        severity: 'HIGH',
                        detail: `Detectado en: ${key}`,
                        sample: value.substring(0, 100)
                    };
                }
            }

            // Path Traversal
            for (const pattern of this.threatDatabase.pathTraversal) {
                if (pattern.test(value)) {
                    return {
                        type: 'PATH_TRAVERSAL',
                        severity: 'CRITICAL',
                        detail: `Detectado en: ${key}`,
                        sample: value.substring(0, 100)
                    };
                }
            }
        }

        return null;
    }

    /**
     * Detecta ataques DNS
     */
    detectDNSAttacks(req) {
        const host = req.headers.host || '';

        // DNS Rebinding
        for (const pattern of this.threatDatabase.dnsRebinding) {
            if (pattern.test(host)) {
                return {
                    type: 'DNS_REBINDING',
                    severity: 'HIGH',
                    detail: host
                };
            }
        }

        // Validar formato de host
        const hostRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z]{2,}$/i;
        if (!hostRegex.test(host)) {
            return {
                type: 'DNS_POISONING',
                severity: 'MEDIUM',
                detail: `Host inválido: ${host}`
            };
        }

        return null;
    }

    /**
     * Detecta acceso a archivos sensibles
     */
    detectSensitiveFileAccess(urlPath) {
        const sensitivePatterns = [
            /\.env|\.config|\.git|\.svn|\.htaccess/i,
            /web\.config|package\.json|composer\.lock/i,
            /npm-debug|\.ssh|credentials|\.aws/i,
            /\/admin|\/wp-admin|\/phpmyadmin|\/cpanel/i,
            /\/\.well-known|\/\.github|\/\.gitlab/i,
            /backup|bak|tmp|temp|old|dump|sql/i
        ];

        for (const pattern of sensitivePatterns) {
            if (pattern.test(urlPath)) {
                return {
                    type: 'SENSITIVE_FILE_ACCESS',
                    severity: 'HIGH',
                    detail: urlPath
                };
            }
        }

        return null;
    }

    /**
     * Detecta comportamientos anómalos
     */
    detectAnomaly(req) {
        const ip = req.ip;

        // Múltiples métodos HTTP diferentes
        if (!this.suspiciousActivity.has(ip)) {
            this.suspiciousActivity.set(ip, {
                methods: new Set(),
                paths: new Set(),
                count: 0,
                firstSeen: Date.now()
            });
        }

        const activity = this.suspiciousActivity.get(ip);
        activity.methods.add(req.method);
        activity.paths.add(req.path);
        activity.count++;

        // Si tiene muchos métodos diferentes = posible scanning
        if (activity.methods.size > 10) {
            return {
                type: 'ABNORMAL_HTTP_METHODS',
                severity: 'MEDIUM',
                detail: `${activity.methods.size} métodos diferentes detectados`
            };
        }

        // Si accede a muchas rutas = posible fuzzing
        if (activity.paths.size > 50 && (Date.now() - activity.firstSeen) < 60000) {
            return {
                type: 'FUZZING_ATTACK',
                severity: 'HIGH',
                detail: `${activity.paths.size} rutas en 1 minuto`
            };
        }

        return null;
    }

    /**
     * Detecta patrones de fuerza bruta
     */
    detectBruteForce(req) {
        const ip = req.ip;
        
        if (!this.suspiciousActivity.has(ip)) {
            return null;
        }

        const activity = this.suspiciousActivity.get(ip);

        // Si hay muchas solicitudes fallidas = fuerza bruta
        if (activity.count > 100 && (Date.now() - activity.firstSeen) < 300000) {
            return {
                type: 'BRUTE_FORCE_ATTEMPT',
                severity: 'HIGH',
                detail: `${activity.count} solicitudes en 5 minutos`
            };
        }

        return null;
    }

    // ========================================
    // RESPUESTA A AMENAZAS
    // ========================================

    /**
     * Maneja amenazas detectadas
     */
    handleThreats(req, threats) {
        const ip = req.ip;
        const timestamp = new Date().toISOString();

        if (threats.length === 0) return true;

        const criticalThreats = threats.filter(t => t.severity === 'CRITICAL');

        if (criticalThreats.length > 0) {
            // Bloquear IP inmediatamente
            this.blockIP(ip, 'CRITICAL_THREAT_DETECTED');
            this.logAlert({
                level: 'CRITICAL',
                ip,
                threats: criticalThreats,
                timestamp,
                action: 'BLOCKED'
            });
            return false;
        }

        // Registrar amenazas altas
        if (threats.some(t => t.severity === 'HIGH')) {
            this.logAlert({
                level: 'HIGH',
                ip,
                threats,
                timestamp,
                action: 'MONITORED'
            });
        }

        return true;
    }

    /**
     * Bloquea una IP
     */
    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        
        const blockEntry = {
            ip,
            reason,
            timestamp: new Date().toISOString(),
            expiration: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        };

        // Guardar en archivo
        const blockListPath = path.join(this.logsPath, 'blocked-ips.json');
        let blockList = [];
        
        if (fs.existsSync(blockListPath)) {
            blockList = JSON.parse(fs.readFileSync(blockListPath, 'utf8'));
        }

        blockList.push(blockEntry);
        fs.writeFileSync(blockListPath, JSON.stringify(blockList, null, 2));

        console.warn(`🚫 IP BLOQUEADA: ${ip} - Razón: ${reason}`);
    }

    /**
     * Verifica si una IP está bloqueada
     */
    isIPBlocked(ip) {
        return this.blockedIPs.has(ip);
    }

    /**
     * Registra alertas
     */
    logAlert(alert) {
        this.alertLog.push(alert);

        const alertPath = path.join(this.logsPath, 'alerts.log');
        fs.appendFileSync(alertPath, JSON.stringify(alert) + '\n');

        if (alert.level === 'CRITICAL') {
            console.error(`🚨 ALERTA CRÍTICA:`, alert);
            this.sendNotification(alert);
        }
    }

    /**
     * Envía notificaciones (email, Slack, etc.)
     */
    sendNotification(alert) {
        // Implementar integración con sistema de notificaciones
        // Ejemplo: webhook, email, SMS, Slack
        console.log('📢 Enviar notificación a administrador:', alert);
    }

    /**
     * Obtiene reporte de seguridad
     */
    getSecurityReport() {
        return {
            blockedIPs: Array.from(this.blockedIPs),
            totalAlerts: this.alertLog.length,
            criticalAlerts: this.alertLog.filter(a => a.level === 'CRITICAL').length,
            highAlerts: this.alertLog.filter(a => a.level === 'HIGH').length,
            lastAlerts: this.alertLog.slice(-10),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = IDS;
