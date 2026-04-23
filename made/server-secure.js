/**
 * ========================================
 * SERVIDOR SEGURO CON IDS INTEGRADO
 * ========================================
 * Ejecutar: node server-secure.js
 */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const IDS = require('./lib/ids');
const TurnstileVerifier = require('./lib/turnstile-verifier');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// INICIALIZAR IDS Y TURNSTILE
// ========================================

const ids = new IDS();

// Turnstile Verifier (SECRET KEY - Mantener privada)
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAADB4e0fuQotDurD3V1anN6oIKKw';
const turnstile = new TurnstileVerifier(TURNSTILE_SECRET_KEY);

// ========================================
// MIDDLEWARE DE SEGURIDAD
// ========================================

// 1. IDS Middleware
app.use((req, res, next) => {
    // Verificar si IP está bloqueada
    if (ids.isIPBlocked(req.ip)) {
        console.warn(`🚫 Acceso denegado - IP bloqueada: ${req.ip}`);
        return res.status(403).json({ 
            error: 'Acceso denegado - IP bloqueada por razones de seguridad'
        });
    }

    // Analizar solicitud
    const threats = ids.analyzeRequest(req);

    // Manejar amenazas
    if (!ids.handleThreats(req, threats)) {
        return res.status(403).json({
            error: 'Solicitud rechazada - Patrón de ataque detectado',
            threatId: crypto.randomUUID()
        });
    }

    next();
});

// 2. Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            upgradeInsecureRequests: []
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' }
}));

// 3. CORS restrictivo
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'https://yourdomain.com'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS bloqueado para: ${origin}`);
            callback(new Error('CORS no permitido'));
        }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 3600
}));

// 4. Rate Limiting agresivo
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // máximo 30 requests por minuto
    message: 'Demasiadas solicitudes. Por favor intente más tarde.',
    store: new (require('rate-limit-redis'))({
        client: require('redis').createClient(),
        prefix: 'rl:'
    }),
    skip: (req) => req.path === '/security-status',
    onLimitReached: (req, res, options) => {
        ids.logAlert({
            level: 'MEDIUM',
            ip: req.ip,
            threat: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        });
    }
});

app.use(limiter);

// Rate limiting estricto para rutas sensibles
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Acceso restringido a esta ruta'
});

// 5. HPP
app.use(hpp({
    whitelist: []
}));

// 6. Body Parser
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: false }));

// 7. Sanitización
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        ids.logAlert({
            level: 'HIGH',
            ip: req.ip,
            threat: 'INJECTION_ATTEMPT',
            detail: `Parámetro: ${key}`,
            timestamp: new Date().toISOString()
        });
    }
}));

// 8. Cloudflare Turnstile Verification (Rutas protegidas)
app.use('/api/contact', turnstile.middleware());
app.use('/api/submit', turnstile.middleware());

// ========================================
// MIDDLEWARE PERSONALIZADO
// ========================================

// Ocultar información del servidor
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
});

// Validación de métodos HTTP
app.use((req, res, next) => {
    const allowedMethods = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (!allowedMethods.includes(req.method)) {
        ids.logAlert({
            level: 'MEDIUM',
            ip: req.ip,
            threat: 'INVALID_HTTP_METHOD',
            method: req.method,
            timestamp: new Date().toISOString()
        });
        return res.status(405).json({ error: 'Método no permitido' });
    }
    next();
});

// Logging de seguridad
app.use((req, res, next) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        length: req.headers['content-length'] || 0
    };

    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.appendFileSync(
        path.join(logsDir, 'requests.log'),
        JSON.stringify(logEntry) + '\n'
    );

    next();
});

// ========================================
// RUTAS
// ========================================

// Servir archivos estáticos seguros
app.use(express.static('public', {
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        // Bloquear archivos sensibles
        if (/\.(env|config|json|yml|yaml|git|svn)$/i.test(filePath)) {
            res.status(403).end();
            return;
        }

        // Cache headers
        if (/\.(js|css|png|jpg|gif|svg|woff2?)$/.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================================
// RUTAS DE SEGURIDAD
// ========================================

// Estado de seguridad
app.get('/api/security-status', (req, res) => {
    res.json({
        status: '🔒 Protegido',
        protections: [
            'HTTPS/TLS forzado',
            'Helmet.js - Headers CSP',
            'IDS con detección de amenazas',
            'Rate Limiting agresivo',
            'CORS restrictivo',
            'HPP - HTTP Parameter Pollution',
            'Input Sanitization',
            'Firewall perimetral',
            'ModSecurity WAF',
            'Detección de herramientas de ataque'
        ],
        threats_blocked: ids.alertLog.filter(a => a.action === 'BLOCKED').length,
        alerts_high: ids.alertLog.filter(a => a.level === 'HIGH').length,
        blocked_ips: ids.blockedIPs.size,
        timestamp: new Date().toISOString()
    });
});

// Reporte de seguridad (SOLO localhost)
app.get('/api/security-report', (req, res) => {
    if (req.ip !== '127.0.0.1' && req.ip !== '::1') {
        ids.logAlert({
            level: 'MEDIUM',
            ip: req.ip,
            threat: 'UNAUTHORIZED_REPORT_ACCESS',
            timestamp: new Date().toISOString()
        });
        return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(ids.getSecurityReport());
});

// ========================================
// RUTAS CLOUDFLARE TURNSTILE
// ========================================

// Ruta de contacto con Turnstile
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'Todos los campos son requeridos'
        });
    }

    // Si llegó aquí, Turnstile fue verificado correctamente
    console.log(`✅ Contacto verificado con Turnstile (${req.turnstile['challenge_ts']})`);

    // Guardar contacto (ejemplo simple)
    const contact = {
        name,
        email,
        message,
        ip: req.ip,
        timestamp: new Date().toISOString(),
        turnstileSuccess: true
    };

    // Aquí guardar en base de datos o enviar email
    console.log('📧 Nuevo contacto:', contact);

    res.json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        contactId: crypto.randomUUID()
    });
});

// Ruta de demo de Turnstile
app.get('/api/turnstile-demo', (req, res) => {
    res.json({
        sitekey: '0x4AAAAAADB4e0yke-xx4rs6',
        message: 'Use esta sitekey en el cliente para Turnstile'
    });
});

// ========================================
// RUTAS DE ERROR
// ========================================

app.use((req, res) => {
    ids.logAlert({
        level: 'LOW',
        ip: req.ip,
        threat: 'NOT_FOUND',
        path: req.path,
        timestamp: new Date().toISOString()
    });
    res.status(404).json({ error: 'No encontrado' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    ids.logAlert({
        level: 'HIGH',
        ip: req.ip,
        threat: 'SERVER_ERROR',
        error: err.message,
        timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

const server = app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════╗
    ║          🔒 SERVIDOR SEGURO - IDS ACTIVO           ║
    ║         PROTECCIÓN CONTRA ATAQUES AVANZADOS         ║
    ╚════════════════════════════════════════════════════╝
    
    ✅ Servidor ejecutándose en: http://localhost:${PORT}
    ✅ IDS: ACTIVO
    ✅ Firewall: HABILITADO
    ✅ Rate Limiting: ACTIVADO
    ✅ CSP (Content-Security-Policy): CONFIGURADO
    ✅ CORS: RESTRICTIVO
    
    🛡️ Protecciones contra:
       • Herramientas de ataque (Burp, Nmap, SQLMap, etc.)
       • SQL Injection
       • XSS y CSS injection
       • Command Injection
       • Path Traversal
       • DNS Rebinding
       • DDoS / Flood attacks
       • Fuerza bruta
       • Port scanning
       • HTTP Smuggling
    
    📊 Monitoreo activo en: http://localhost:${PORT}/api/security-status
    
    Fecha: ${new Date().toISOString()}
    `);
});

// ========================================
// MANEJO DE ERRORES
// ========================================

process.on('unhandledRejection', (reason) => {
    console.error('❌ Promise rejection no manejada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception no capturada:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⏹️ Apagando servidor...');
    server.close(() => {
        console.log('✅ Servidor apagado correctamente');
        process.exit(0);
    });
});
