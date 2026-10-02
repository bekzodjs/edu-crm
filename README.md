# Edu CRM — O'quv markazlari uchun CRM

React + NestJS + MongoDB (Mongoose) asosida qurilgan to'liq CRM tizimi. O'quvchilar, guruhlar,
o'qituvchilar, dars jadvali, davomat, to'lov, qarzdorlik, o'qituvchilar uchun Telegram orqali
kelish/ketish (jonli joylashuv bilan) va ariza (ta'til so'rovi) hamda ota-onaga avtomatik
bildirishnoma — barchasi shu loyihada bor.

## Texnologiyalar

- **Backend:** NestJS, TypeScript, Mongoose (MongoDB ODM), MongoDB Atlas, JWT autentifikatsiya
- **Frontend:** React + Vite + TypeScript, React Router, Tailwind CSS
- **Telegram bot:** node-telegram-bot-api (polling rejimida, webhook shart emas)

## Loyiha tuzilishi

```
edu-crm/
  backend/    — NestJS API server
  frontend/   — React admin panel
  docker-compose.yml — Mongo + backend + frontend'ni bir buyruq bilan ishga tushirish
```

## 1. Tezkor ishga tushirish (Docker bilan)

Agar kompyuteringizda Docker o'rnatilgan bo'lsa, eng oson yo'l:

```bash
docker compose up -d --build
```

- Backend: http://localhost:3000/api
- Frontend: http://localhost:5173
- Standart admin: telefon `+998900000000`, parol `admin12345` (docker-compose.yml ichida o'zgartirishingiz mumkin)
- Production uchun `JWT_SECRET`ni albatta o'zgartiring: `JWT_SECRET=$(openssl rand -hex 32) docker compose up -d --build`
  (`NODE_ENV=production` bo'lsa, standart kalit bilan server umuman ishga tushmaydi)

## 2. Qo'lda ishga tushirish

### 2.1. MongoDB

Loyiha Mongoose orqali oddiy MongoDB'ga ulanadi — alohida replica set yoki maxsus dvigatel
(binary) shart emas. Eng oson yo'li — MongoDB Atlas'da bepul cluster yaratish va uning
connection string'ini `DATABASE_URL`ga qo'yish, yoki lokal Mongo:

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

### 2.2. Backend

```bash
cd backend
cp .env.example .env
# .env faylida DATABASE_URL, JWT_SECRET va boshqalarni to'ldiring

npm install
npm run seed               # birinchi admin foydalanuvchini va demo ma'lumotlarni yaratadi
npm run start:dev          # http://localhost:3000/api
```

> **Muhim izoh:** Mongoose hech qanday alohida "generate" yoki "db push" bosqichini talab
> qilmaydi — sxemalar (`src/database/schemas.ts`) ilova ishga tushganda MongoDB'ga avtomatik
> ulanadi va zarur indekslarni o'zi yaratadi. Shunchaki `npm install` va `npm run start:dev`
> kifoya.

### 2.3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL backend manzilini ko'rsatsin
npm install
npm run dev              # http://localhost:5173
```

Tizimga admin telefon/parol bilan kiring (yuqoridagi seed skriptida ko'rsatilgan).

## 3. Telegram bot sozlash

1. Telegram'da [@BotFather](https://t.me/BotFather) orqali yangi bot yarating, tokenni oling.
2. `backend/.env` faylida:
   ```
   TELEGRAM_BOT_TOKEN="123456:ABC-..."
   TELEGRAM_BOT_ENABLED=true
   ```
3. Backendni qayta ishga tushiring. Konsolda "Telegram bot polling rejimida ishga tushdi" deb chiqadi.

### Ota-onalar uchun

4. Admin panelda biror o'quvchi profiliga kirib, **"Bog'lash kodi yaratish"** tugmasini bosing —
   bir martalik kod chiqadi (masalan `A1B2C3D4`).
5. Ota-onaga botning username'ini va shu buyruqni yuboring: `/start A1B2C3D4`.
6. Shundan keyin ota-ona botga quyidagi buyruqlarni yuborishi mumkin:
   - `/qarz` — joriy oy qarzdorligi
   - `/davomat` — so'nggi 5 ta dars davomati
   - `/baho` — farzandi shu hafta va shu oy olgan baholari (o'rtacha ball va so'nggi baholar)
   - `/ariza` — farzandi haqida ariza yuborish (masalan darsga kela olmasligi haqida sabab bilan)

Davomat "Kelmadi" yoki "Kechikdi" deb belgilanganda, yangi to'lov qayd qilinganda, yoki yangi uyga
vazifa berilganda, tizim **avtomatik** ravishda bog'langan ota-onaga Telegram orqali xabar yuboradi.
Ota-onalar arizalarini admin panelning **"Ota-onalar arizalari"** sahifasida ko'rib chiqish mumkin.

### O'qituvchilar uchun

4. Admin panelda **O'qituvchilar** sahifasida tegishli o'qituvchi qatorida **"Bog'lash kodi"**
   tugmasini bosing va kodni o'qituvchiga yuboring: `/start <kod>`.
5. Bog'langandan so'ng o'qituvchi quyidagi buyruqlardan foydalanishi mumkin:
   - `/keldim` — ishga kelganini tasdiqlash uchun joylashuvini yuboradi (davomat CHECK_IN sifatida
     qayd etiladi, "Jonli joylashuv" faollashadi)
   - `/ketyapman` — ishdan ketayotganini tasdiqlash uchun joylashuvini yuboradi (CHECK_OUT, jonli
     joylashuv o'chadi)
   - `/ariza <sabab>` — sabab ko'rsatib ariza (ta'til so'rovi) yuboradi; sababni alohida xabar
     sifatida ham yuborish mumkin
6. Ish vaqtida Telegram'ning **"Jonli joylashuv ulashish"** funksiyasini yoqib qo'ysa, bot uning
   joylashuvini muntazam yangilab turadi — bu ma'lumot admin panelning **"O'qituvchilar davomati"**
   sahifasida real vaqtda ko'rinadi (xarita havolasi bilan).
7. Admin **"Arizalar"** sahifasida kelgan arizalarni ko'rib, tasdiqlashi yoki rad etishi mumkin —
   qaror qabul qilinganda o'qituvchiga Telegram orqali avtomatik xabar boradi. Barcha arizalar va
   ularning holati tizimda saqlanib boradi.

## 4. Asosiy funksiyalar (talab qilingan ro'yxat bo'yicha)

| Funksiya | Qayerda |
|---|---|
| O'quvchilar | `/students` — CRUD, guruhlarga biriktirish, qidiruv/filtr, profil sahifasi (to'lovlar tarixi, baholar, chegirma) |
| Guruhlar | `/groups` — CRUD, o'qituvchi biriktirish, narx belgilash |
| O'qituvchilar | `/teachers` — CRUD (faqat ADMIN/SUPERADMIN), qidiruv (ism/familiya bosh harfi, telefon), profil sahifasi (hujjatlar, Telegram bog'lash) |
| Dars jadvali | `/schedule` — haftalik takrorlanuvchi slotlar + sana oralig'i uchun aniq darslar generatsiyasi |
| Davomat | `/attendance` — har bir dars uchun o'quvchilar davomatini belgilash |
| Uyga vazifalar | `/homework` — o'qituvchi guruhga vazifa beradi (fayl yoki video havola), ota-onaga avtomatik xabar |
| Baholar | `/grades` — o'qituvchi o'quvchilarga baho (1–10) qo'yadi; profil/bot orqali haftalik-oylik xulosa |
| Chegirmalar | har oyning 1-kunida avtomatik: har guruhning o'tgan oy bo'yicha eng top 5 o'quvchisiga 10% chegirma (`/discounts/run-monthly` orqali qo'lda ham ishga tushirish mumkin) |
| To'lov | `/payments` — to'lovlarni qayd qilish, oy/usul bo'yicha filtrlash, pagination |
| Qarzdorlik | `/debts` — har bir o'quvchi bo'yicha kutilgan/to'langan/qarz (chegirma hisobga olingan holda) avtomatik hisoblanadi |
| O'qituvchilar davomati | `/teacher-attendance` — Telegram orqali kelish/ketish + jonli joylashuv xaritada |
| O'qituvchilar arizalari (ta'til) | `/leave-requests` — o'qituvchi Telegram botdan yuboradi, admin tasdiqlaydi/rad etadi |
| Ota-onalar arizalari (farzandi haqida) | `/parent-requests` — ota-ona Telegram botdan yuboradi, admin tasdiqlaydi/rad etadi |
| Foydalanuvchilar va rollar | `/users` (faqat SUPERADMIN) — ADMIN/RAHBAR/O'QITUVCHI login'larini qo'shish, tahrirlash, o'chirish |
| Telegram bot | yuqoridagi 3-bo'lim |
| Ota-onaga notification | kelmagan/kechikkan darsda, yangi to'lovda va yangi uyga vazifada avtomatik Telegram xabar |

## 5. Rollar (kirish huquqlari)

| Rol | Huquqlari |
|---|---|
| SUPERADMIN | Hammasi + `/users` sahifasida ADMIN/RAHBAR/O'QITUVCHI login'larini qo'shish, tahrirlash, o'chirish |
| ADMIN | O'qituvchi/o'quvchi/guruh CRUD, to'lov, ariza tasdiqlash va h.k. — `/users`ga kirolmaydi |
| RAHBAR | Ko'rish huquqi asosiy (hisobot/monitoring uchun mo'ljallangan) |
| O'QITUVCHI | O'z guruhlariga vazifa/baho qo'yadi, davomat belgilaydi; o'quvchi/o'qituvchi CRUD qilolmaydi |

Birinchi (seed) hisob **SUPERADMIN** sifatida yaratiladi (`npm run seed`, skript: `backend/scripts/seed.ts`).
Yangi login'lar endi faqat `/users` sahifasidan (SUPERADMIN tomonidan) yaratiladi — ochiq `/auth/register`
endpoint olib tashlandi (xavfsizlik uchun).

### Xavfsizlik bo'yicha eslatmalar

- Parollar faqat bcrypt hash ko'rinishida saqlanadi — ochiq matnli nusxa saqlanmaydi va ko'rsatilmaydi.
  Parolini unutgan foydalanuvchi uchun `/users` sahifasidagi "Parolni almashtirish"dan foydalaning.
- Login: bitta telefon raqam uchun 15 daqiqa ichida 5 marta noto'g'ri parol kiritilsa, vaqtincha bloklanadi.
- O'QITUVCHI faqat o'z guruhlari bilan ishlaydi: o'z guruhining darslari, davomati, baholari, uyga
  vazifalari va o'quvchilari; boshqa o'qituvchilarning joylashuvi va Telegram bog'lash kodlarini ko'rmaydi.
- Telegram bog'lash kodi bir martalik: bog'langandan keyin boshqa chat shu kod bilan ulana olmaydi.
- Yuklanadigan fayllar turi cheklangan (rasm, PDF, Office hujjatlari, video/audio); xavfli turlar
  brauzerda ochilmaydi, faqat yuklab olinadi.

## 6. Keyingi qadamlar (agar rivojlantirmoqchi bo'lsangiz)

- Payme/Click to'lov tizimlari bilan real integratsiya (hozir to'lovlar qo'lda kiritiladi)
- Qarzdorlik uchun avtomatik eslatma jadvali (masalan har kuni soat 10:00da `@nestjs/schedule`
  yordamida qarzdorlarga eslatma yuborish — `@nestjs/schedule` paketi allaqachon o'rnatilgan va
  chegirma hisoblash uchun ishlatilmoqda)
- SMS orqali zaxira xabar yuborish (Telegram'ga ulanmagan ota-onalar uchun)
- RAHBAR roli uchun alohida, faqat-o'qish hisobot paneli
