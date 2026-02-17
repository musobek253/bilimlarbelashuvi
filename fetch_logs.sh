#!/bin/bash
SERVER_IP="135.181.98.134"
USER="root"
PASSWORD="Muhammad202206$"

echo "🔍 Fetching logs from Game Service..."
/usr/bin/expect <<EOF
set timeout 60
spawn ssh $USER@$SERVER_IP "docker logs root-game-1 --tail 300"
expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$PASSWORD\r" }
}
expect eof
EOF
