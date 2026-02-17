#!/usr/bin/expect -f

# Sozlamalar
set user "root"
set host "135.181.98.134"
set password "Muhammad202206$"
set timeout -1

puts "\n🚀 Avtomatik Deploy Boshlanmoqda..."

# 1. Arxivlash
puts "📦 Fayllar arxivlanmoqda..."
system "tar --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.DS_Store' --exclude='project.tar.gz' -czf project.tar.gz apps package.json docker-compose.prod.yml deploy.sh auto_deploy.sh .env Caddyfile"

# 2. Serverga yuklash (SCP)
puts "📤 Serverga yuklanmoqda..."
spawn scp project.tar.gz $user@$host:/root/
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$password\r" }
}
expect eof

# 3. Serverda buyruqlarni bajarish (SSH)
puts "🛠  Serverda o'rnatilmoqda..."
spawn ssh $user@$host
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$password\r" }
}

# SSH kirgandan keyin buyruqlarni yuborish
expect "#"
send "tar -xzf project.tar.gz\r"
expect "#"
send "rm project.tar.gz\r"
expect "#"

# Caddy Sozlash (HTTPS)
puts "🔒 HTTPS (Caddy) sozlanmoqda..."
# Caddy o'rnatilganligini tekshirish va o'rnatish
send "apt update && apt install -y debian-keyring debian-archive-keyring apt-transport-https\r"
expect "#"
send "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes\r"
expect "#"
send "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list\r"
expect "#"
send "apt update && apt install caddy -y\r"
expect "#"

# Caddyfile ni joylash
send "mv Caddyfile /etc/caddy/Caddyfile\r"
expect "#"
send "systemctl reload caddy\r"
expect "#"

# Docker Compose ni qayta ishga tushirish
puts "🔄 Docker yangilanmoqda..."
send "docker compose -f docker-compose.prod.yml down --remove-orphans\r"
expect "#"
# Ba'zan konteynerlar o'chmay qolishi mumkin, majburiy tozalash
send "docker rm -f root-bot-1 root-auth-1 root-game-1 root-gateway-1 root-frontend-1 root-postgres-1 root-redis-1 || true\r"
expect "#"
send "docker compose -f docker-compose.prod.yml up -d --build\r"
expect "#"

# Ortiqcha narsalarni tozalash
send "docker image prune -f\r"
expect "#"

# Chiqish
send "exit\r"
expect eof

puts "\n✅ DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
