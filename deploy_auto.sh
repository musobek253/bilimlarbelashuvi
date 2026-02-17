#!/bin/bash
SERVER_IP="135.181.98.134"
USER="root"
PASSWORD="Muhammad202206$"

echo "📦 Archiving..."
tar --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.DS_Store' --exclude='project.tar.gz' -czf project.tar.gz apps package.json docker-compose.prod.yml .env

echo "🚀 Uploading..."
/usr/bin/expect <<EOF
set timeout 300
spawn scp project.tar.gz $USER@$SERVER_IP:/root/
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$PASSWORD\r" }
}
expect eof
EOF

echo "🛠 Deploying $1..."
/usr/bin/expect <<EOF
set timeout 600
set service [lindex \$argv 0]
spawn ssh $USER@$SERVER_IP
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$PASSWORD\r" }
}
expect "#"
send "cd /root\r"
send "tar -xzf project.tar.gz\r"
send "rm project.tar.gz\r"
if { [string length "\$service"] > 0 } {
    send "docker compose -f docker-compose.prod.yml up -d --build --remove-orphans \$service\r"
} else {
    send "docker compose -f docker-compose.prod.yml up -d --build --remove-orphans\r"
}
send "docker image prune -f\r"
send "exit\r"
expect eof
EOF "$1"

echo "✅ Done!"
