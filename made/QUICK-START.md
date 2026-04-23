# ⚡ GUÍA RÁPIDA - MADE SEGURO

## 🚀 INICIO RÁPIDO

```bash
# Opción 1: Docker (Recomendado)
bash start-all.sh
# Seleccionar: 1

# Opción 2: PM2
pm2 start ecosystem.config.json

# Opción 3: Directo
npm start
node monitor-recovery.js  # en otra terminal
```

---

## 📊 MONITOREO

### Acceso Rápido

```
Sitio principal:        http://localhost:3000
Prometheus:             http://localhost:9090
Grafana:                http://localhost:3005
Monitor (instancia 1):   http://localhost:3001/stats
```

### Logs en Vivo

```bash
tail -f logs/monitor.log       # Monitoreo
tail -f logs/alerts.log        # Alertas
docker-compose logs -f app-1   # Docker
pm2 logs                        # PM2
```

---

## 🚨 EMERGENCIAS

### Si cae el servidor:

```bash
# El monitor auto-recupera en 30-60s
# verificar:
curl http://localhost:3000/api/security-status

# Si sigue caido (> 3 minutos):
sudo bash recover-emergency.sh
```

### Si está atacado:

```bash
# Ver IPs bloqueadas
cat logs/blocked-ips.json

# Ver alertas recientes
tail -20 logs/alerts.log

# Bloquear IP específica (manual)
sudo iptables -A INPUT -s 192.168.1.100 -j DROP
```

---

## 🔧 MANTENIMIENTO

### Reiniciar

```bash
# Docker
docker-compose restart

# PM2
pm2 restart all

# Manual
pkill -f "node server" && npm start
```

### Backup manual

```bash
tar -czf backups/backup-$(date +%s).tar.gz . \
    --exclude=node_modules --exclude=.git
```

### Restaurar backup

```bash
tar -xzf backups/backup-XXXXXXX.tar.gz
# O automático:
sudo bash recover-emergency.sh
```

---

## 📈 ESTADÍSTICAS

```bash
# Ver stats en tiempo real
curl http://localhost:3001/stats | jq

# Ver procesos
docker-compose ps
pm2 list

# Uso de recursos
docker stats
pm2 monit
```

---

## 🛡️ SEGURIDAD

### Verificar estado

```bash
# Reporte completo
bash verify-security.sh

# Rápido
curl http://localhost:3000/api/security-status
```

### Actualizar firewall

```bash
sudo bash firewall-rules.sh
```

---

## 📋 CHECKLIST DIARIO

- [ ] Comprobar uptime: `pm2 list` o `docker-compose ps`
- [ ] Revisar logs: `tail -100 logs/alerts.log`
- [ ] Verificar IPs bloqueadas: `cat logs/blocked-ips.json | wc -l`
- [ ] Backup verificado: `ls -lah backups/ | head`

---

## 🔐 PROTECCIONES ACTIVAS

✅ HTTPS/TLS  
✅ WAF (ModSecurity)  
✅ IDS (Detección de intrusiones)  
✅ Rate Limiting  
✅ Firewall (iptables)  
✅ CSP Headers  
✅ Input Validation  
✅ Auto-Recovery  
✅ Failover automático  
✅ High Availability  

---

## 📞 CONTACTO

| Tipo | Contacto |
|------|----------|
| 🚨 Crítico | +XX XXX XXX XXXX |
| ⚠️ Importante | critical@domain.com |
| 📝 General | info@domain.com |

---

## 🎯 SLA

```
Disponibilidad: 99.98%
Downtime máximo: 1 hora 3 minutos/año
Tiempo de recuperación: < 15 minutos
RTO: 5-10 minutos
RPO: < 1 hora
```

---

## ❓ TROUBLESHOOTING

### Servidor no responde
```bash
# 1. Verificar si está corriendo
docker-compose ps
pm2 list

# 2. Verificar puerto
lsof -i :3000

# 3. Ver logs
docker-compose logs app-1
pm2 logs

# 4. Reiniciar
docker-compose restart
pm2 restart all
```

### Alto uso de memoria
```bash
# Ver consumo
docker stats
pm2 monit

# Reiniciar proceso
docker-compose restart app-1
pm2 restart made-server
```

### Muchas IPs bloqueadas
```bash
# Ver lista
cat logs/blocked-ips.json | jq '.[] | .ip' | wc -l

# Limpiar IP específica
# Editar logs/blocked-ips.json y quitar entrada

# Bloquear IP manualmente
sudo iptables -A INPUT -s x.x.x.x -j DROP
```

---

**Última actualización:** 2024-04-23  
**Versión:** 1.0  
**Estado:** ✅ ACTIVO
