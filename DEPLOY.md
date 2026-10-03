# Edu CRM — bepul deploy (Vercel + Render + MongoDB Atlas)

| Qism | Qayer | Manzil namunasi |
|---|---|---|
| Frontend (React/Vite) | Vercel | https://edu-crm.vercel.app |
| Backend (NestJS) | Render, Free Web Service (Docker) | https://edu-crm-backend.onrender.com/api |
| Baza | MongoDB Atlas, M0 Free | mongodb+srv://... |

## 1. MongoDB Atlas
1. https://cloud.mongodb.com → yangi loyiha → **Create cluster → M0 (Free)**.
2. **Database Access** → foydalanuvchi va parol yarating.
3. **Network Access** → `0.0.0.0/0` qo'shing (Render IP manzili doimiy emas).
4. **Connect → Drivers** → ulanish manzilini nusxalang, bazaning nomini qo'shing:
   `mongodb+srv://USER:PAROL@cluster0.xxxxx.mongodb.net/edu_crm?retryWrites=true&w=majority`

## 2. Render (backend)
1. https://render.com → GitHub bilan kiring → **New + → Blueprint** → `bekzodjs/edu-crm` reposini tanlang.
   Render `render.yaml` faylini o'qiydi va `edu-crm-backend` servisini yaratadi.
2. Render so'raydigan qiymatlar:
   - `DATABASE_URL` — Atlas manzili (1-qadam)
   - `FRONTEND_URL` — Vercel manzili (hozircha `*` deb qo'yib turing, 3-qadamdan keyin almashtirasiz)
   - `TELEGRAM_BOT_TOKEN` — @BotFather'dan olingan token
   - `TELEGRAM_WEBHOOK_URL` — servisning o'z manzili, masalan `https://edu-crm-backend.onrender.com` (`/api` siz)
   - `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` — birinchi SUPERADMIN login'i
3. Deploy tugagach tekshiring: `https://edu-crm-backend.onrender.com/api/health` → `{"status":"ok"}`.

> Birinchi ishga tushishda seed bo'sh bazaga SUPERADMIN va demo ma'lumot qo'shadi.
> Keyingi ishga tushishlarda hech narsa o'chirilmaydi yoki takrorlanmaydi.

## 3. Vercel (frontend)
1. https://vercel.com → **Add New → Project** → `bekzodjs/edu-crm`.
2. **Root Directory**: `frontend` (Framework: Vite, `vercel.json` tayyor).
3. **Environment Variables**: `VITE_API_URL = https://edu-crm-backend.onrender.com/api`
4. Deploy → hosil bo'lgan manzilni Render'dagi `FRONTEND_URL` ga yozing (Render qayta deploy qiladi).

## 4. Serverni uyg'oq ushlab turish (UptimeRobot)
Render bepul servisi 15 daqiqa so'rovsiz qolsa uxlaydi. https://uptimerobot.com → **New monitor**:
- Type: HTTP(s), URL: `https://edu-crm-backend.onrender.com/api/health`, Interval: 5 daqiqa.

Shunda oylik `@Cron` (har oyning 1-kuni) va Telegram bot kechikmasdan ishlaydi.

## Telegram bot rejimlari
- `TELEGRAM_WEBHOOK_URL` berilgan → **webhook** (Render). Telegram xabarlarni `POST /api/telegram/webhook` ga yuboradi,
  so'rov `X-Telegram-Bot-Api-Secret-Token` header orqali tekshiriladi.
- Bo'sh → **polling** (lokal kompyuterda). Polling ishga tushganda eski webhook avtomatik o'chiriladi.
  Eslatma: bitta token bilan lokal polling ishlatsangiz, production webhook o'chadi — Render'ni qayta ishga tushirsangiz qayta o'rnatiladi.

## Cheklovlar
- **Yuklangan fayllar** (`uploads/` — o'qituvchi hujjatlari, uy vazifalari) Render bepul tarifida doimiy saqlanmaydi:
  har deploy yoki qayta ishga tushishda o'chib ketadi. Doimiy saqlash uchun keyinchalik Cloudinary yoki
  Cloudflare R2 (bepul tariflari bor) ulash kerak.
- Atlas M0: 512 MB joy.
