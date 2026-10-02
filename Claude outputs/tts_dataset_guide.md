# TTS AI uchun dataset yig'ish bo'yicha qo'llanma

## 1. Har bir audio yozuvga qanday "zametka" (metadata) yoziladi

Har bir audio fayl bilan birga quyidagi ma'lumotlar saqlanadi:

- **audio fayl** — WAV yoki FLAC formatda, 22–48 kHz, 16–24 bit
- **matn (transkript)** — audio ichida aynan nima aytilgani, normallashtirilgan holda
- **spiker ID** — kim gapirayotgani (bir xil odamning barcha yozuvlari bitta ID bilan bog'lanadi)
- **jinsi** — ayol / erkak
- **yoshi yoki yosh guruhi** — masalan: 20-29, 30-39, 40-49 va h.k.
- **shevasi/hududi** — agar lahjalar farqlansa
- **yozuv sharoiti** — studiya, xona, shovqin darajasi, mikrofon turi
- **(ixtiyoriy) emotsiya** — neytral, quvnoq, jiddiy va h.k.

Bundan tashqari, butun **matn skripti** (odamlarga o'qitiladigan gaplar to'plami) tilning barcha tovushlari (fonemalar) va ularning kombinatsiyalarini bir necha marta qamrab olishi kerak — bu alohida har bir yozuvga emas, balki umumiy skriptga tegishli talab.

## 2. Qanday video karta (GPU) kerak bo'ladi

| Maqsad | GPU / VRAM | Misol kartalar |
|---|---|---|
| Tayyor modelni fine-tune qilish (XTTS-v2, Piper, GPT-SoVITS) | 8–12 GB | RTX 3060 12GB, RTX 3070/3080 |
| Ovoz klonlash (few-shot, 1 daqiqadan 1 soatgacha namuna) | 8–16 GB | RTX 3070–4070 |
| Kattaroq modellar bilan ishlash (Fish Speech S2-Pro va h.k.) | 24 GB | RTX 3090 / 4090 |
| Noldan (from scratch) ko'p-spikerli model o'qitish | 24 GB+ | RTX 3090/4090, A5000/A6000, yoki bulutda A100 |
| Faqat ishlatish (inference), o'qitish emas | 2–8 GB | RTX 3050/4060 ham yetadi |

Agar shaxsiy kuchli GPU bo'lmasa, kichik jamoalar uchun eng amaliy yo'l — **bulutdan GPU ijaraga olish** (RunPod, Vast.ai): 3090/4090 darajasidagi karta soatiga taxminan $0.3–1.5, A100 esa $1–3 atrofida turadi.

## 3. Dataset qanday farqlanadi (jins va yosh bo'yicha)

Datasetlarni ayol/erkak va yosh guruhlariga bo'lib yig'ishning sababi:

- Model faqat bitta ovoz "uslubi"ga qotib qolmasligi uchun (balans muhim)
- Ilovada foydalanuvchiga bir nechta ovoz varianti taklif qilish uchun
- Yosh ovoz balandligi (pitch), formantlar va gapirish tezligiga ta'sir qiladi — model bularning barchasini ko'rgan bo'lishi kerak

**Taxminiy hajm:**
- Bitta toza ovoz uchun oddiy TTS: **10–20 soat** yozuv
- Ko'p spikerli, ekspressiv/mustahkam model uchun: **50–100 soat**
- Ovoz klonlash usullarida (XTTS-v2, GPT-SoVITS): bir spiker uchun bir necha daqiqadan 1 soatgacha ham yetarli, lekin sifat ko'proq ma'lumot bilan oshadi

**Balanslash bo'yicha odatiy amaliyot:** ayol/erkak taxminan teng nisbatda, yosh esa 3–4 ta guruhga bo'linadi (masalan: 20-lar, 30-40, 50+), har bir guruhda taxminan bir xil umumiy soat bo'lishi kerak — shunda birorta guruh ustunlik qilib ketmaydi.

## 4. Mashhur ochiq datasetlar (namuna sifatida)

| Dataset | Tavsif |
|---|---|
| **LJSpeech** | Bitta ayol spiker, ~24 soat, faqat matn+audio, metadata yo'q — eng sodda tuzilma |
| **VCTK** | 110 ta ingliz spiker, ~44 soat, har bir spiker uchun ID, jinsi, yoshi, aksenti yozilgan |
| **Common Voice (Mozilla)** | Ko'plab tillar (o'zbekcha ham bor), har yozuvda jinsi va yosh guruhi (teens/20s/30s...) belgilangan |
| **LibriTTS** | Audiokitoblardan olingan, ko'p spikerli |
| **FeruzaSpeech** | O'zbek tili uchun ~60 soatlik o'qish nutqi korpusi — o'zbekcha loyihalar uchun to'g'ridan-to'g'ri foydali namuna |

## 5. Dataset yig'ish uchun tavsiya etilgan vositalar

1. **Yozib olish** — doimiy mikrofon/xonada, Audacity yoki **Piper Recording Studio** (skript bo'yicha yozuv sessiyasini boshqarib, to'g'ridan-to'g'ri kerakli formatga eksport qiladi)
2. **Transkripsiya/tekshirish** — OpenAI **Whisper** bilan avtomatik matnga o'girish, keyin albatta qo'lda tekshirish
3. **Alignment (moslashtirish)** — **Montreal Forced Aligner (MFA)** yordamida so'z/fonema darajasida audio-matn moslashtirilishi
4. **Tozalash** — ovoz balandligini normallashtirish, sukut joylarni kesish, kerakli chastotaga (masalan 22.05/24 kHz) o'tkazish
5. **Tuzilma** — `wavs/` papka + `metadata.csv` (LJSpeech uslubida) yoki barcha metadata ustunlari bilan `.tsv` fayl
6. **O'qitish** — Coqui TTS/XTTS-v2 trainer, Piper skriptlari yoki GPT-SoVITS'ning o'zining few-shot pipeline'i — kichik jamoa uchun eng amaliy boshlanish nuqtalari

---

*Manbalar: FutureBeeAI metadata/hours guide, Coqui TTS GitHub muhokamalari, GigaGPU XTTS-v2 VRAM tahlili, ssamjh Piper qo'llanmasi, NexGPU Fish Speech, GPT-SoVITS repo, HuggingFace VCTK/Common Voice sahifalari, arXiv FeruzaSpeech (2410.00035), Montreal Forced Aligner hujjatlari.*
