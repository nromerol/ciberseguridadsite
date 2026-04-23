# 🔒 GUÍA COMPLETA DE SEGURIDAD - MADE CIBERSEGURIDAD

## ÍNDICE
1. [Visión General](#visión-general)
2. [Amenazas Detectadas](#amenazas-detectadas)
3. [Capas de Defensa](#capas-de-defensa)
4. [Instalación y Configuración](#instalación-y-configuración)
5. [Línea de Respuesta a Incidentes](#línea-de-respuesta-a-incidentes)

---

## VISIÓN GENERAL

Este sitio web está protegido con múltiples capas de seguridad contra:
- ✅ Herramientas de ataque automatizadas
- ✅ SQL Injection y Code Injection
- ✅ XSS (Cross-Site Scripting)
- ✅ DDoS/Ataques de inundación
- ✅ DNS Rebinding
- ✅ Port Scanning (Nmap)
- ✅ HTTP Fuzzing
- ✅ Fuerza bruta
- ✅ Ataques HTTP avanzados

---

## AMENAZAS DETECTADAS Y BLOQUEADAS

### 1. HERRAMIENTAS DE ATAQUE AUTOMATIZADAS

Detecta y bloquea:
```
• Burp Suite
• NMAP / Zenmap
• Nikto Scanner
• SQLMap
• Masscan
• Nessus
• OpenVAS
• Metasploit
• Acunetix
• DirBuster
• OWASP ZAP
• w3af
• Hydra
• Wfuzz
• Gobuster
```

**Respuesta:** Bloqueo inmediato + Registro de alerta + Bloqueo de IP

---

### 2. INYECCIONES SQL

**Patrones detectados:**
```sql
UNION SELECT ... FROM ...
SELECT * FROM users ...
INSERT INTO ... VALUES ...
DELETE FROM ...
DROP TABLE ...
; --
; /*
' OR '1'='1
```

**Respuesta:** Bloqueo (403 Forbidden) + Alerta CRÍTICA

---

### 3. CROSS-SITE SCRIPTING (XSS)

**Patrones detectados:**
```html
<script>alert('XSS')</script>
javascript: alert()
onerror=alert()
onload=alert()
<iframe src=...>
eval()
```

**Respuesta:** Bloqueo + Sanitización automática + Alerta

---

### 4. ATAQUES DNS

**Tipos:**
- DNS Rebinding (localhost, 127.0.0.1)
- DNS Poisoning (host inválido)
- DNS Amplification

**Respuesta:** Validación strict de headers + Bloqueo de patrones sospechosos

---

### 5. ATAQUE DE FUERZA BRUTA

**Detección:**
- Múltiples solicitudes fallidas consecutivas
- Múltiples métodos HTTP por IP
- Intentos repetidos en corto tiempo

**Respuesta:** Bloqueo temporal + Rate limiting

---

### 6. PORT SCANNING Y ENUMERACIÓN

**Detecta:**
- Demasiadas solicitudes HEAD
- Múltiples rutas en corto tiempo (fuzzing)
- Escaneo de métodos HTTP

**Respuesta:** Bloqueo + Alerta

---

### 7. HTTP SMUGGLING Y RESPONSE SPLITTING

**Patrones:**
```
Transfer-Encoding + Content-Length conflictivos
Headers con \r\n inyectados
```

**Respuesta:** Bloqueo duro

---

## CAPAS DE DEFENSA

### CAPA 1: FIREWALL PERIMETRAL (iptables)

```bash
# Bloquea puertos peligrosos
- FTP (21)
- Telnet (23)
- RDP (3389)
- Bases de datos (3306, 5432, etc.)

# Rate limiting
- ICMP: 1/s con burst de 5
- UDP: 1/s con burst de 10
- SYN Flood protection

# Protecciones contra scanning
- Descartar fragmentos IP
- Bloquear XMAS scans
- Bloquear NULL scans
```

---

### CAPA 2: WEB APPLICATION FIREWALL (ModSecurity)

```
- Detecta herramientas de ataque por User-Agent
- Bloquea patrones de inyección
- Valida headers HTTP
- Protege contra path traversal
- Previene acceso a archivos sensibles
- Registra todos los ataques detectados
```

---

### CAPA 3: SISTEMA DE DETECCIÓN DE INTRUSIONES (IDS)

**Funciones:**
```javascript
- Análisis de User-Agent
- Detección de inyecciones (SQL, Command, XSS)
- Análisis de comportamiento anómalo
- Detección de fuzzing
- Detección de fuerza bruta
- Logging y alertas en tiempo real
- Bloqueo automático de IPs
```

---

### CAPA 4: HEADERS DE SEGURIDAD HTTP

```
Content-Security-Policy: Previene XSS
X-Frame-Options: Previene clickjacking
X-Content-Type-Options: Previene MIME sniffing
HSTS: Força HTTPS
Referrer-Policy: Controla información de referencia
Permissions-Policy: Bloquea APIs del navegador
```

---

### CAPA 5: PROTECCIÓN DEL CLIENTE

```javascript
- Sanitización automática de entrada
- Validación de URLs y emails
- Detección de XSS/SQL en cliente
- Token CSRF
- Timeout de sesión
- Limpieza de elementos peligrosos
```

---

### CAPA 6: RATE LIMITING

```
- 30 solicitudes/minuto por IP
- 5 solicitudes/15min para rutas sensibles
- Bloqueo automático si se excede
- Logs detallados
```

---

### CAPA 7: HTTPS/TLS

```
- TLS 1.2+
- Certificados SSL válidos
- HSTS (1 año)
- Redirección HTTP → HTTPS
- Cipher suites seguros
```

---

## INSTALACIÓN Y CONFIGURACIÓN

### 1. APACHE + MOD_SECURITY

```bash
# Instalar ModSecurity
sudo apt-get install libapache2-mod-security2

# Habilitar módulo
sudo a2enmod mod-security2

# Copiar reglas
sudo cp modsecurity-rules.conf /etc/modsecurity/

# Reiniciar Apache
sudo systemctl restart apache2

# Copiar .htaccess
cp .htaccess /var/www/html/
```

---

### 2. NGINX + MODSECURITY

```bash
# Instalar nginx con ModSecurity
sudo apt-get install libnginx-mod-security

# Copiar configuración
sudo cp nginx-security.conf /etc/nginx/sites-enabled/

# Validar configuração
sudo nginx -t

# Recargar
sudo systemctl reload nginx
```

---

### 3. NODE.JS

```bash
# Instalar dependencias
npm install

# Ejecutar servidor seguro
npm start

# Ver reporte de seguridad (localhost)
curl http://localhost:3000/api/security-report
```

---

### 4. FIREWALL

```bash
# Configurar firewall
sudo bash firewall-rules.sh

# Ver reglas
sudo iptables -L -n -v

# Verificar logs
sudo tail -f /var/log/syslog
```

---

## LÍNEA DE RESPUESTA A INCIDENTES

### ALERTA CRÍTICA DETECTADA

1. **Inmediato:**
   ```
   - Bloquear IP agresivamente
   - Registrar en logs detallados
   - Enviar notificación a admin
   ```

2. **Dentro de 1 minuto:**
   ```
   - Revisar logs de seguridad
   - Identificar tipo de ataque
   - Aumentar monitoreo
   ```

3. **Dentro de 5 minutos:**
   ```
   - Comunicar al equipo de seguridad
   - Analizar patrones
   - Actualizar reglas si es necesario
   ```

4. **Documentar:**
   ```
   - Guardar evidencia
   - Crear reporte de incidente
   - Analizar causa raíz
   ```

---

## ARCHIVOS DE CONFIGURACIÓN

### Árbol de seguridad
```
made/
├── .htaccess                      # Headers de seguridad (Apache)
├── nginx-security.conf            # Configuración nginx
├── modsecurity-rules.conf         # Reglas WAF
├── firewall-rules.sh              # Script de firewall
├── server-secure.js               # Servidor Node.js
├── package.json                   # Dependencias
│
├── assets/
│   └── js/
│       └── security.js            # Protección del cliente
│
└── lib/
    └── ids.js                    # Sistema de detección de intrusiones
```

---

## MONITOREO Y LOGS

### Archivos de log

```
logs/
├── access.log                     # Solicitudes HTTP
├── alerts.log                     # Alertas de seguridad
├── blocked-ips.json              # IPs bloqueadas
└── requests.log                   # Requests detalladas
```

---

## MÉTRICAS DE SEGURIDAD

```javascript
// Obtener en: http://localhost:3000/api/security-status

{
  "status": "🔒 Protegido",
  "threats_blocked": 134,
  "alerts_high": 8,
  "blocked_ips": 5,
  "average_response_time": "45ms"
}
```

---

## MEJORES PRÁCTICAS

✅ **HACER:**
- Mantener software actualizado
- Revisar logs regularly
- Actualizar reglas de WAF
- Realizar auditorías de seguridad
- Hacer backups regulares
- Usar HTTPS siempre
- Implementar 2FA

❌ **NO HACER:**
- Exponer puertos innecesarios
- Permitir acceso directo a DB
- Confiar en seguridad del cliente
- Usar HTTP sin encriptación
- Ejecutar servicios con permisos root
- Guardar contraseñas en texto plano

---

## RESPUESTA A ATAQUES ESPECÍFICOS

### Ataque con Burp Suite
```
→ User-Agent detectado
→ Bloqueo inmediato
→ IP bloqueada 24h
→ Alerta CRÍTICA
```

### Ataque con NMAP
```
→ Multiple HEAD requests detectados
→ Patrón de scanning detectado
→ Bloqueo inicial
→ Rate limiting agresivo
```

### Intento de SQL Injection
```
→ Patrón detectado en parámetros
→ Validación automática
→ Bloqueo 403
→ Sanitización de entrada
```

### DDoS Flood
```
→ Limite de rate alcanzado
→ Bloqueo por IP
→ Limite aumento automático
→ Fail2ban activado
```

---

## CONTACTO Y ESCALACIÓN

🚨 **CRÍTICO:** 
- Email: security@domain.com
- SMS: +XX XXX XXX XXXX
- Slack: #security-alerts

---

## REFERENCIAS

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE - Common Weakness Enumeration](https://cwe.mitre.org/)
- [ModSecurity Rules](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Última actualización:** 2024-04-23
**Versión:** 1.0 - PRODUCCIÓN
**Estado:** ✅ ACTIVO
