/**
 * ========================================
 * SERVIDOR NODE.JS - SEGURIDAD ROBUSTA
 * ========================================
 * Ejecutar: node server.js
 */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE DE SEGURIDAD
// ========================================

// 1. Helmet - Headers de seguridad HTTP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    },
    hsts: {
        maxAge: 31536000, // 1 año
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
        geolocation: [],
        camera: [],
        microphone: [],
        payment: []
    }
}));

// 2. CORS - Control de origen
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// 3. Rate Limiting - Prevención de DDoS/Fuerza Bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 requests por IP
    message: 'Demasiadas peticiones desde esta IP, intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // muy estricto para ciertas rutas
    message: 'Acceso denegado por límite de peticiones'
});

app.use(limiter);

// 4. HPP - HTTP Parameter Pollution
app.use(hpp({
    whitelist: []
}));

// 5. Body Parser con límite
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 6. Sanitización de datos
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`⚠️  Intento de inyección detectado en: ${key}`);
    }
}));

// ========================================
// MIDDLEWARE PERSONALIZADO
// ========================================

// Bloquear User-Agents sospechosos
app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const dangerousAgents = ['bot', 'crawler', 'scraper', 'nikto', 'nmap', 'sqlmap', 'nessus'];
    
    if (dangerousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
        console.warn(`⚠️  Acceso bloqueado - User-Agent sospechoso: ${userAgent}`);
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
});

// Detectar patrones de SQL injection
app.use((req, res, next) => {
    const checkValue = (value) => {
        if (typeof value === 'string') {
            const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i;
            if (sqlPattern.test(value)) {
                console.warn(`⚠️  Intento de SQL Injection detectado: ${value}`);
                return true;
            }
        }
        return false;
    };
    
    // Verificar query y body
    for (const key in req.query) {
        if (checkValue(req.query[key])) {
            return res.status(403).json({ error: 'Solicitud bloqueada' });
        }
    }
    
    for (const key in req.body) {
        if (checkValue(req.body[key])) {
            return res.status(403).json({ error: 'Solicitud bloqueada' });
        }
    }
    
    next();
});

// Logging de seguridad
app.use((req, res, next) => {
    const log = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer']
    };
    
    // Logging en archivo
    const logPath = path.join(__dirname, 'logs', 'access.log');
    if (!fs.existsSync(path.join(__dirname, 'logs'))) {
        fs.mkdirSync(path.join(__dirname, 'logs'));
    }
    
    fs.appendFileSync(logPath, JSON.stringify(log) + '\n');
    next();
});

// ========================================
// RUTAS
// ========================================

// Servir archivos estáticos
app.use(express.static('public', {
    setHeaders: (res, path) => {
        // Evitar cacheado de archivos HTML
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        
        // Archivos estáticos con larga vida de caché
        if (/\.(js|css|png|jpg|gif|svg|woff|woff2)$/.test(path)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        
        // Prevenir descarga de archivos sensibles
        if (/\.(env|config|json|yml|yaml)$/.test(path)) {
            return res.status(403).send('Acceso denegado');
        }
    }
}));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de seguridad - información sobre protecciones
app.get('/security-status', (req, res) => {
    res.json({
        status: 'Sitio protegido',
        protections: [
            'HTTPS/TLS',
            'Helmet.js',
            'Rate Limiting',
            'CORS',
            'CSP',
            'HSTS',
            'HPP',
            'Input Sanitization',
            'SQL Injection Detection',
            'XSS Protection'
        ],
        timestamp: new Date().toISOString()
    });
});

// Rutas de error
app.use((req, res) => {
    res.status(404).json({ error: 'No encontrado' });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║  🔒 SERVIDOR SEGURO - CIBERSEGURIDAD   ║
    ╚════════════════════════════════════════╝
    
    ✅ Servidor ejecutándose en: http://localhost:${PORT}
    ✅ Protecciones activadas: HELMET, RATE-LIMIT, CORS, CSP
    ✅ Fecha: ${new Date().toISOString()}
    
    Para acceso en HTTPS (recomendado en producción):
    - Usar certificado SSL/TLS
    - Configurar nginx o Apache con reverse proxy
    `);
});

// ========================================
// MANEJO DE ERRORES NO CAPTURADOS
// ========================================

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejection no manejada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception no capturada:', error);
    process.exit(1);
});
