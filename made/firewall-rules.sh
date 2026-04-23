#!/bin/bash
# ========================================
# FIREWALL - IPTABLES / UFW
# ========================================
# Ejecutar con: sudo bash firewall-rules.sh

echo "🔒 Configurando Firewall de Seguridad..."

# Limpiar reglas existentes
sudo iptables -F
sudo iptables -X
sudo iptables -Z

# ========================================
# POLÍTICAS POR DEFECTO
# ========================================

# Denegar todo por defecto
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# ========================================
# PERMITIR TRÁFICO LEGÍTIMO
# ========================================

# Loopback interface
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# Conexiones establecidas
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# ICMP (ping) - limitado para prevenir ataques
sudo iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 5 -j ACCEPT
sudo iptables -A INPUT -p icmp -j DROP

# ========================================
# PERMITIR PUERTOS ESENCIALES
# ========================================

# SSH (conexión remota)
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 3 -j DROP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# HTTP
sudo iptables -A INPUT -p tcp --dport 80 -m state --state NEW -j ACCEPT

# HTTPS
sudo iptables -A INPUT -p tcp --dport 443 -m state --state NEW -j ACCEPT

# ========================================
# BLOQUEAR PUERTOS PELIGROSOS
# ========================================

# Telnet - nunca usar
sudo iptables -A INPUT -p tcp --dport 23 -j DROP

# FTP - usar SFTP/SCP en su lugar
sudo iptables -A INPUT -p tcp --dport 21 -j DROP

# RDP
sudo iptables -A INPUT -p tcp --dport 3389 -j DROP

# SMTP sin autenticación
sudo iptables -A INPUT -p tcp --dport 25 -j DROP

# Protocolo de escaneo
sudo iptables -A INPUT -p tcp --dport 1433 -j DROP  # SQL Server
sudo iptables -A INPUT -p tcp --dport 3306 -j DROP  # MySQL
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP  # PostgreSQL
sudo iptables -A INPUT -p tcp --dport 5984 -j DROP  # CouchDB

# ========================================
# PROTECCIÓN CONTRA ATAQUES COMUNES
# ========================================

# SYN Flood Protection
sudo iptables -A INPUT -p tcp ! --syn -m state --state NEW -j DROP

# Port Scanning Protection (nmap, zenmap)
sudo iptables -N port-scanning
sudo iptables -A port-scanning -p tcp --tcp-flags SYN,ACK,FIN,RST RST -m limit --limit 1/s --limit-burst 2 -j RETURN
sudo iptables -A port-scanning -j DROP

# Fragmented Packet Protection
sudo iptables -A INPUT -f -j DROP

# XMAS Scan Protection
sudo iptables -A INPUT -p tcp --tcp-flags ALL FIN,PSH,URG -j DROP
sudo iptables -A INPUT -p tcp --tcp-flags ALL SYN,FIN,PSH,URG -j DROP

# Null Scan Protection
sudo iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP

# UDP Flood Protection
sudo iptables -A INPUT -p udp -m limit --limit 1/s --limit-burst 10 -j ACCEPT
sudo iptables -A INPUT -p udp -j DROP

# ========================================
# PROTECCIÓN CONTRA DNS AMPLIFICATION
# ========================================

# Limitar DNS responses
sudo iptables -A INPUT -p udp --dport 53 -m limit --limit 1/s --limit-burst 10 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 53 -j DROP

# Bloquear DNS recursivo desde el exterior
# (Solo permitir desde redes autorizadas)

# ========================================
# PROTECCIÓN CONTRA NETWORK SCANNING
# ========================================

# Rate limiting general
sudo iptables -A INPUT -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
sudo iptables -A INPUT -m limit --limit 25/minute -j LOG --log-prefix "DROP_LOW_RATE: "
sudo iptables -A INPUT -j DROP

# HTTP/HTTPS rate limiting
sudo iptables -A INPUT -p tcp --dport 80 -m limit --limit 30/second --limit-burst 100 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -m limit --limit 30/second --limit-burst 100 -j ACCEPT

# ========================================
# REGISTRAR EL TRÁFICO
# ========================================

# Log de paquetes rechazados
sudo iptables -A INPUT -j LOG --log-prefix "iptables-drop: " --log-level 7

# ========================================
# SALVAR REGLAS
# ========================================

# Guardar reglas (Debian/Ubuntu)
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Para persistencia en systemd
sudo bash -c 'cat > /etc/systemd/system/iptables-restore.service << EOF
[Unit]
Description=Restore iptables rules
Before=network.target

[Service]
Type=oneshot
ExecStart=/sbin/iptables-restore /etc/iptables/rules.v4
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable iptables-restore.service

echo "✅ Firewall configurado correctamente"
echo "📊 Reglas activas:"
sudo iptables -L -n -v
