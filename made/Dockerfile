FROM node:18-alpine

# Instalar herramientas necesarias
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    openssl \
    ca-certificates \
    lsof \
    procps \
    net-tools

WORKDIR /app

# Copiar archivos
COPY package*.json ./
COPY server-secure.js ./
COPY monitor-recovery.js ./
COPY ecosystem.config.json ./
COPY assets/ ./assets/
COPY lib/ ./lib/
COPY index.html ./
COPY .htaccess ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm install -g pm2

# Crear directorio de logs
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/security-status || exit 1

# Exponer puerto 3000
EXPOSE 3000 3001

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Ejecutar PM2
CMD ["pm2-runtime", "start", "ecosystem.config.json"]
