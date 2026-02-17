# 🏆 Bilimlar Belashuvi (Battle Quiz)

**Bilimlar Belashuvi** — bu o'quvchilar uchun mo'ljallangan, real vaqt rejimida (real-time) bilimlarini sinash imkonini beruvchi interaktiv musobaqa platformasi. Loyiha "Arqon tortish" (Tug of War) mexanikasi asosida qurilgan bo'lib, to'g'ri javoblar orqali raqibni o'z tomoniga tortish vizual effekti bilan boyitilgan.

## 🚀 Asosiy Xususiyatlar

- **Real-time Matchmaking**: Foydalanuvchilar o'z sinflari va fanlari bo'yicha avtomatik tarzda raqib topishlari mumkin.
- **Interaktiv O'yin Jarayoni**: Har bir to'g'ri javob "arqonni" o'yinchi tomonga suradi, noto'g'ri javob esa raqibga ustunlik beradi.
- **Telegram Web App Integratsiyasi**: Dastur bevosita Telegram ichida ishlaydi, bu esa foydalanuvchilarga qulaylik yaratadi.
- **Fanlar va Sinflar**: Matematika va boshqa fanlar bo'yicha turli murakkablikdagi savollar bazasi.
- **Reyting va Leaderboard**: Eng kuchli bilimdonlar ro'yxati va foydalanuvchi profili (g'alabalar, mag'lubiyatlar, reyting).
- **Admin Panel**: Savollarni boshqarish, foydalanuvchilar ma'lumotlarini tahrirlash va tizim holatini kuzatish.

## 🛠 Texnologiyalar

Loyiha zamonaviy **Microservices** arxitekturasi asosida qurilgan:

- **Frontend**: React.js, Vite, Zustand (state management), Tailwind CSS/Shadcn UI.
- **Backend (Microservices)**:
  - **Gateway**: Barcha so'rovlarni boshqaruvchi va Socket.io orqali real-time aloqani ta'minlovchi markaz.
  - **Auth Service**: Foydalanuvchi autentifikatsiyasi (Telegram), profil boshqaruvi va ma'lumotlar bazasi (PostgreSQL + Prisma).
  - **Game Service**: O'yin mantiqi, matchmaking (navbat tizimi) va Redis orqali tezkor ma'lumot almashinuvi.
  - **Bot Service**: Telegram bot interfeysi.
- **Infratuzilma**: Docker & Docker Compose, Redis, PostgreSQL.

## 📦 O'rnatish va Ishga tushirish

1.  **Repozitoriyani yuklab oling**:
    ```bash
    git clone https://github.com/musobek253/bilimlarbelashuvi.git
    cd bilimlarbelashuvi
    ```

2.  **Muhit o'zgaruvchilarini sozlang**:
    `.env` faylini yarating va kerakli tokenlarni (Telegram Bot Token, DB URL va h.k.) kiriting.

3.  **Docker orqali ishga tushiring**:
    ```bash
    docker compose up -d --build
    ```

## 📝 Muallif
Loyiha **Bilimlar Belashuvi** jamoasi tomonidan ta'limni o'yin orqali qiziqarli qilish maqsadida yaratilgan.
