/**
 * ========================================
 * MIDDLEWARE CLOUDFLARE TURNSTILE
 * ========================================
 * Verificación de CAPTCHA Turnstile
 */

const https = require('https');

class TurnstileVerifier {
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    }

    /**
     * Verifica el token de Turnstile
     */
    async verify(token, remoteIp = null) {
        return new Promise((resolve, reject) => {
            const postData = new URLSearchParams({
                secret: this.secretKey,
                response: token,
                ...(remoteIp && { remoteip: remoteIp })
            });

            const options = {
                hostname: 'challenges.cloudflare.com',
                port: 443,
                path: '/turnstile/v0/siteverify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': postData.toString().length
                },
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Turnstile verification timeout'));
            });

            req.write(postData.toString());
            req.end();
        });
    }

    /**
     * Express middleware
     */
    middleware() {
        return async (req, res, next) => {
            // Rutas que NO requieren Turnstile
            const whitelistedRoutes = ['/', '/api/security-status', '/health'];
            
            if (whitelistedRoutes.includes(req.path)) {
                return next();
            }

            const token = req.body['cf-turnstile-response'] || req.query.token;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Token de Turnstile requerido'
                });
            }

            try {
                const result = await this.verify(token, req.ip);

                if (result.success) {
                    req.turnstile = result;
                    next();
                } else {
                    console.warn(`❌ Turnstile verification fallido: ${JSON.stringify(result)}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Verificación CAPTCHA fallida',
                        'error-codes': result['error-codes']
                    });
                }
            } catch (error) {
                console.error('❌ Error verificando Turnstile:', error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error en verificación de seguridad',
                    details: error.message
                });
            }
        };
    }
}

module.exports = TurnstileVerifier;
