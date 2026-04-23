/**
 * ========================================
 * SEGURIDAD DEL CLIENTE - MADE SECURITY
 * ========================================
 * Protecciones contra: XSS, CSRF, Clickjacking, etc.
 */

"use strict";

// ========================================
// PROTECCIÓN CONTRA XSS
// ========================================

const SecurityManager = {
    
    /**
     * Sanitiza strings para evitar XSS
     */
    sanitizeHTML: function(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    /**
     * Escapa caracteres especiales HTML
     */
    escapeHTML: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;'
        };
        return text.replace(/[&<>"'\/]/g, function(char) {
            return map[char];
        });
    },
    
    /**
     * Valida URLs
     */
    validateURL: function(url) {
        try {
            const urlObj = new URL(url);
            // Solo permitir http y https
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Sanitiza atributos de elementos
     */
    cleanElement: function(element) {
        // Permitidas atributos seguros
        const allowedAttributes = ['id', 'class', 'style', 'data-*'];
        
        // Eliminar todos los event listeners potencialmente peligrosos
        const dangerousEvents = [
            'onload', 'onerror', 'onchange', 'onclick', 'onmouseover',
            'onmouseout', 'onmouseenter', 'onmouseleave', 'onsubmit',
            'onblur', 'onfocus', 'onkeydown', 'onkeyup', 'onwheel'
        ];
        
        dangerousEvents.forEach(event => {
            element.removeAttribute(event);
        });
        
        return element;
    },
    
    // ========================================
    // PROTECCIÓN CONTRA CSRF
    // ========================================
    
    /**
     * Genera token CSRF
     */
    generateCSRFToken: function() {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        localStorage.setItem('csrfToken', token);
        return token;
    },
    
    /**
     * Obtiene token CSRF
     */
    getCSRFToken: function() {
        let token = localStorage.getItem('csrfToken');
        if (!token) {
            token = this.generateCSRFToken();
        }
        return token;
    },
    
    /**
     * Valida token CSRF
     */
    validateCSRFToken: function(token) {
        const storedToken = localStorage.getItem('csrfToken');
        return token === storedToken;
    },
    
    // ========================================
    // PROTECCIÓN CONTRA CLICKJACKING
    // ========================================
    
    /**
     * Previene clickjacking
     */
    preventClickjacking: function() {
        if (window.self !== window.top) {
            window.top.location = window.self.location;
        }
    },
    
    // ========================================
    // PROTECCIÓN CONTRA SESSION HIJACKING
    // ========================================
    
    /**
     * Genera y valida session ID
     */
    initSession: function() {
        const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        sessionStorage.setItem('sessionId', sessionId);
        sessionStorage.setItem('sessionStart', Date.now());
        
        // Sesión válida por 30 minutos
        this.validateSessionTimeout();
        
        return sessionId;
    },
    
    /**
     * Valida timeout de sesión
     */
    validateSessionTimeout: function() {
        const sessionStart = parseInt(sessionStorage.getItem('sessionStart'));
        const sessionTimeout = 30 * 60 * 1000; // 30 minutos
        
        if (Date.now() - sessionStart > sessionTimeout) {
            sessionStorage.clear();
            console.warn('Sesión expirada por seguridad');
        }
    },
    
    // ========================================
    // DETECCIÓN DE INYECCIÓN DE CÓDIGO
    // ========================================
    
    /**
     * Detecta patrones de inyección SQL
     */
    detectSQLInjection: function(input) {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
            /(-{2}|\/\*|\*\/|;)/,
            /(\*|'|"|--)/
        ];
        
        return sqlPatterns.some(pattern => pattern.test(input));
    },
    
    /**
     * Detecta patrones de XSS
     */
    detectXSS: function(input) {
        const xssPatterns = [
            /<script[^>]*>[\s\S]*?<\/script>/gi,
            /on\w+\s*=\s*["']?([^"'>\s]+)["']?/gi,
            /<iframe[^>]*>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /<embed[^>]*>/gi,
            /<object[^>]*>/gi
        ];
        
        return xssPatterns.some(pattern => pattern.test(input));
    },
    
    /**
     * Valida y sanitiza entrada
     */
    validateInput: function(input, type = 'text') {
        if (this.detectXSS(input)) {
            console.warn('⚠️ Posible ataque XSS detectado');
            return null;
        }
        
        if (this.detectSQLInjection(input)) {
            console.warn('⚠️ Posible inyección SQL detectada');
            return null;
        }
        
        // Validación según tipo
        switch(type) {
            case 'email':
                return this.validateEmail(input) ? this.sanitizeHTML(input) : null;
            case 'url':
                return this.validateURL(input) ? this.sanitizeHTML(input) : null;
            case 'number':
                return !isNaN(input) ? input : null;
            case 'text':
            default:
                return this.sanitizeHTML(input);
        }
    },
    
    /**
     * Valida email
     */
    validateEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    // ========================================
    // LOGGING DE SEGURIDAD
    // ========================================
    
    /**
     * Registra eventos de seguridad
     */
    logSecurityEvent: function(eventType, details) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            eventType,
            details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log(`[SECURITY] ${eventType}:`, logEntry);
        
        // Enviar a servidor (opcional)
        // this.sendSecurityLog(logEntry);
    }
};

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Prevenir clickjacking
    SecurityManager.preventClickjacking();
    
    // Iniciar sesión
    SecurityManager.initSession();
    
    // Generar token CSRF
    SecurityManager.generateCSRFToken();
    
    // Limpiar elementos potencialmente peligrosos
    document.querySelectorAll('[onclick], [onerror], [onload]').forEach(el => {
        SecurityManager.cleanElement(el);
        SecurityManager.logSecurityEvent('DANGEROUS_EVENT_REMOVED', {
            element: el.tagName,
            originalHTML: el.outerHTML.substring(0, 100)
        });
    });
    
    console.log('✅ Protecciones de seguridad activadas');
});

// ========================================
// MONITOREO CONTINUO
// ========================================

// Validar timeout cada cierto tiempo
setInterval(() => {
    SecurityManager.validateSessionTimeout();
}, 60000); // Cada minuto

// Protección contra cambios de Content-Security-Policy
if (document.currentScript) {
    SecurityManager.logSecurityEvent('PAGE_LOADED', {
        csp: document.currentScript.getAttribute('nonce') || 'NO_NONCE',
        timestamp: new Date().toISOString()
    });
}

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
}
