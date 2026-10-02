import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

// Brauzerda to'g'ridan-to'g'ri ochilishi xavfsiz bo'lgan fayl turlari. Qolganlari (masalan
// .html, .svg, .js) faqat yuklab olish uchun beriladi — aks holda ular API domenida skript
// sifatida ishga tushib (stored XSS) tokenni o'g'irlashi mumkin edi.
export const INLINE_SAFE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.mp4', '.webm', '.mp3', '.ogg', '.txt',
]);

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const DOCUMENT_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS, '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.rar',
]);
export const HOMEWORK_EXTENSIONS = new Set([...DOCUMENT_EXTENSIONS, '.mp4', '.webm', '.mp3', '.ogg']);

export function safeFilename(originalname: string) {
  const safe = originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
}

/** Multer fileFilter: faqat ruxsat etilgan kengaytmalarni qabul qiladi. */
export function extensionFilter(allowed: Set<string>) {
  return (_req: any, file: { originalname: string }, cb: (err: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (allowed.has(ext)) return cb(null, true);
    cb(new BadRequestException(`Bu turdagi fayl qabul qilinmaydi (${ext || 'kengaytmasiz'})`), false);
  };
}
