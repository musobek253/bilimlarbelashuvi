#!/bin/bash

# Server ma'lumotlari
SERVER_IP="135.181.98.134"
USER="root"

echo "============================================"
echo "🚀 Deploy jarayoni boshlandi..."
echo "============================================"

# 1. Loyihani arxivlash
echo "📦 1. Fayllar arxivlanmoqda..."
tar --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.DS_Store' --exclude='project.tar.gz' -czf project.tar.gz apps package.json docker-compose.prod.yml

# 2. Serverga yuklash
echo "Upload 2. Serverga yuklanmoqda ($SERVER_IP)..."
echo "⚠️  Parol so'ralsa, server parolini kiriting."
scp project.tar.gz $USER@$SERVER_IP:/root/

# 3. Serverda ishga tushirish
echo "🛠  3. Serverda o'rnatilmoqda..."
ssh $USER@$SERVER_IP << 'EOF'
  # Arxivni ochish
  tar -xzf project.tar.gz
  rm project.tar.gz

  # Docker konteynerlarini yangilash (Eskisini o'chirib, yangisini quradi)
  echo "🔄 Docker Compose ishga tushmoqda..."
  docker compose -f docker-compose.prod.yml down
  docker compose -f docker-compose.prod.yml up -d --build

  # Ortiqcha fayllarni tozalash (joyni tejash uchun)
  docker image prune -f
EOF

echo "============================================"
echo "✅ DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
echo "Applikatsiya yangilandi: https://22-maktab.uz"
echo "============================================"
