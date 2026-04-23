# ☁️ GUÍA CLOUDFLARE - MADE CIBERSEGURIDAD

## 🎯 OBJETIVO

Desplegar tu sitio MADE en Cloudflare con máxima disponibilidad y seguridad.

---

## ✅ REQUISITOS PREVIOS

1. **Dominio registrado** (ej: made.com)
2. **Cuenta Cloudflare gratuita o pago**
3. **Aplicación corriendo localmente** (verificado)
4. **Cloudflare Turnstile configurado** ✅

---

## 📝 PASO 1: CONFIGURAR NAMESERVERS EN CLOUDFLARE

### 1.1 Agregar sitio a Cloudflare

1. Ve a https://dash.cloudflare.com
2. Click en "**+ Agregar un sitio**"
3. Ingresa tu dominio: `yourdomain.com`
4. Selecciona plan (Gratuito es suficiente para empezar)
5. Click en "**Continuar**"

### 1.2 Cambiar Nameservers

Cloudflare te dará 2 nameservers. Copia:
```
NS1: ns1.cloudflare.com
NS2: ns2.cloudflare.com
(Los exactos variarán)
```

Ve a tu proveedor de dominios (GoDaddy, Namecheap, etc.) y actualiza los nameservers.

**Tiempo:** 24-48 horas para propagación completa

---

## 🔐 PASO 2: CONFIGURAR SSL/TLS

### 2.1 Modo SSL

1. En Cloudflare Dashboard → SSL/TLS
2. Selecciona modo: **"Flexible"** (recomendado inicialmente)
   - Flexible: Cliente→Cloudflare (HTTPS) / Cloudflare→Servidor (HTTP)
   - Full: Todo HTTPS
   - Full (Strict): Requiere certificados válidos en servidor

### 2.2 Certificados

Cloudflare proporciona certificados gratis automáticamente.

```
📌 IMPORTANTE: Si tu servidor está en localhost/privado:
   - Usa "Flexible"
   - Si es VPS con IP pública, usa "Full (Strict)"
```

---

## 🤖 PASO 3: CONFIGURAR CLOUDFLARE TURNSTILE

### 3.1 Crear CAPTCHA

1. Dashboard → Turnstile
2. Click "**Create a Site**"
3. Nombre: `MADE Security`
4. Dominios: `yourdomain.com` y `www.yourdomain.com`
5. Tipo de widget: Recomendado "**Managed challenge**"
6. Theme: "Light" o "Dark"

### 3.2 Obtener Credenciales

Copiar y guardar en lugar SEGURO:
```
Site Key: 0x4AAAAAADB4e0yke-xx4rs6
Secret Key: 0x4AAAAAADB4e0fuQotDurD3V1anN6oIKKw
```

**⚠️ MUY IMPORTANTE:**
- Site Key: Se puede exponer (usada en cliente)
- Secret Key: NUNCA exponerla (guardar en variables de entorno)

---

## 🚀 PASO 4: DESPLEGAR EN SERVIDOR

### 4.1 Opción A: VPS/Servidor Dedicado

```bash
# 1. SSH al servidor
ssh user@server-ip

# 2. Clonar repositorio
git clone https://github.com/tuusuario/made.git
cd made

# 3. Instalar Node.js si no está
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Instalar PM2 globalmente
sudo npm install -g pm2

# 5. Instalar dependencias
npm ci --only=production

# 6. Crear archivo .env
cat > .env << EOF
NODE_ENV=production
PORT=3000
TURNSTILE_SECRET_KEY=0x4AAAAAADB4e0fuQotDurD3V1anN6oIKKw
EOF

# 7. Iniciar con PM2
pm2 start ecosystem.config.json
pm2 startup
pm2 save

# 8. Configurar Nginx como reverse proxy (ver sección 4.2)
```

### 4.2 Configurar Nginx como Reverse Proxy

```bash
# Instalar Nginx
sudo apt-get install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/made

# Pegar esta configuración:
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Logs
    access_log /var/log/nginx/made_access.log;
    error_log /var/log/nginx/made_error.log;

    # Proxy a Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/made /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Habilitar Nginx en startup
sudo systemctl enable nginx
```

### 4.3 Opción B: Cloudflare Pages/Workers

Cloudflare Pages es opción alternativa para hosting estático.

```bash
# 1. Instalar Wrangler
npm install -g wrangler

# 2. Conectar GitHub
# Dashboard → Pages → Connect Git

# 3. Deploy automático en cada push
```

---

## ⚙️ PASO 5: CONFIGURAR CLOUDFLARE RULES

### 5.1 Page Rules

Dashboard → Rules → Page Rules

```
URL: https://yourdomain.com/admin/*
Acción: Acceso bloqueado

URL: https://yourdomain.com/.env
Acción: Acceso bloqueado

URL: https://yourdomain.com/.git/*
Acción: Acceso bloqueado
```

### 5.2 WAF Rules

Dashboard → Security → WAF

```
Habilitar:
✅ OWASP ModSecurity Core Rule Set
✅ Cloudflare Managed Ruleset
✅ Rate Limiting Rules
```

### 5.3 DDoS Protection

Dashboard → Security → DDoS

```
Sensibilidad: High
```

---

## 🔍 PASO 6: VERIFICAR CONFIGURACIÓN

### 6.1 DNS

```bash
# Verificar que Cloudflare está intermediando
nslookup yourdomain.com

# Resultado esperado:
# Address: 104.21.X.X (o similar - IP de Cloudflare)
```

### 6.2 SSL/TLS

```bash
# Verificar certificado
openssl s_client -connect yourdomain.com:443

# Debería mostrar certificado de Cloudflare
```

### 6.3 Turnstile

```bash
# Ir a: https://yourdomain.com/contact
# Verificar que Turnstile carga correctamente
```

---

## 📊 PASO 7: MONITOREO EN DASHBOARD

### Métricas a Monitorear

1. **Tráfico:**
   - Request rate
   - Bandwidth
   - Visitors

2. **Seguridad:**
   - HTTP Status Codes
   - Threats blocked
   - Bot traffic

3. **Performance:**
   - Page load time
   - Cache hit ratio
   - Origin response time

Dashboard → Analytics

---

## 🔒 VARIABLES DE ENTORNO (PRODUCCIÓN)

**Crear archivo `.env` seguro:**

```bash
# Node.js
NODE_ENV=production
PORT=3000
LOG_LEVEL=error

# Turnstile (NUNCA exponerla)
TURNSTILE_SECRET_KEY=0x4AAAAAADB4e0fuQotDurD3V1anN6oIKKw

# Opcional: Redis
REDIS_URL=redis://localhost:6379

# Opcional: Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=app-password
```

**Proteger archivo:**
```bash
chmod 600 .env
```

---

## 📱 CONFIGURAR CLOUDFLARE MOBILE APP

1. Descargar app Cloudflare
2. Login con tu cuenta
3. Monitorear:
   - Ataques bloqueados
   - Tráfico
   - Alertas

---

## 🚨 TROUBLESHOOTING

### Problema 1: ERR_TOO_MANY_REDIRECTS

```
Solución:
1. Dashboard → SSL/TLS
2. Cambiar a "Flexible" o "Full"
3. Verificar Nginx redirección
```

### Problema 2: Turnstile no carga

```
Solución:
1. Verificar sitekey en HTML
2. Verificar dominios en Cloudflare Turnstile config
3. Revisar console.log de navegador
4. Borrar cache (Ctrl+Shift+Delete)
```

### Problema 3: Sitio lento

```
Solución:
1. Cloudflare → Caching → Purge cache
2. Habilitar HTTP/2
3. Verificar origen está respondiendo
4. Aumentar timeout
```

---

## 💡 OPTIMIZACIONES RECOMENDADAS

### 1. Caching

Dashboard → Caching

```
Nivel de caché: Aggressive
Tiempo de vida (TTL): 30 minutos
Auto Purge: Enabled
```

### 2. Compression

Dashboard → Speed → Optimization

```
✅ Brotli compression
✅ Minify CSS/JS/HTML
✅ Rocket Loader (off para Node.js)
```

### 3. Image Optimization

```
✅ Polish (Smart)
✅ WebP automatic
```

### 4. Performance

```
✅ Early Hints
✅ HTTP/2
✅ HTTP/3 (QUIC)
```

---

## 📈 MONITORING CONTINUO

### Alertas Recomendadas

1. **Traffic Changes** - More than 10x normal
2. **Error Rate** - More than 5%
3. **High CPU** - On origin server
4. **DDoS Attack** - Any attack detected

Configurar en: Dashboard → Notifications

---

## 🔑 CLOUDFLARE API TOKEN

Para automatización:

1. Dashboard → My Profile → API Tokens
2. Create Token → "Edit zone DNS"
3. Copiar token
4. Usar para actualizaciones automáticas

```bash
# Ejemplo: Actualizar DNS record
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"example.com","content":"1.2.3.4","ttl":1}'
```

---

## ✅ CHECKLIST FINAL

- [ ] Dominio registrado
- [ ] Nameservers cambiados a Cloudflare
- [ ] DNS propagado (24-48h)
- [ ] SSL/TLS configurado
- [ ] Turnstile creado y credenciales guardadas
- [ ] Servidor/VPS preparado
- [ ] aplicación desplegada
- [ ] Nginx reverse proxy configurado
- [ ] Turnstile integrado en aplicación
- [ ] Variables de entorno configuradas
- [ ] Certificados verificados
- [ ] Formulario de contacto funcionando
- [ ] Cloudflare Rules configuradas
- [ ] DDoS Protection habilitado
- [ ] Monitoreo activo
- [ ] Alertas configuradas
- [ ] Analytics revisado

---

## 📞 SOPORTE

- **Cloudflare Docs:** https://developers.cloudflare.com/
- **Turnstile Docs:** https://developers.cloudflare.com/turnstile/
- **Forum:** https://community.cloudflare.com/

---

## 🎉 CONCLUSIÓN

Tu sitio MADE ahora está:

✅ **Protegido por Cloudflare** (Global CDN + DDoS Protection)
✅ **Con Turnstile CAPTCHA** (Anti-Bot)
✅ **SSL/TLS Automático** (Certificados gratis)
✅ **Disponibilidad Global** (Servidores en todo el mundo)
✅ **Monitorizado 24/7** (Dashboard)

**Tiempo de implementación:** 1-2 horas
**Costo:** Gratuito (o $200+/mes si quieres plan premium)

---

**Última actualización:** 2024-04-23  
**Status:** ✅ LISTO PARA PRODUCCIÓN
