import { useEffect, useMemo, useState } from 'react';

/**
 * Uzun ro'yxatlarni sahifalab (client tomonida) ko'rsatish uchun umumiy hook.
 * Backend hali sahifalashni qo'llab-quvvatlamaydigan ro'yxatlar uchun ishlatiladi —
 * butun ro'yxat olib kelinadi, lekin bir vaqtning o'zida faqat bitta sahifa render
 * qilinadi (shu bilan sahifa juda uzun bo'lib ketmaydi).
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Ro'yxat almashganda (qidiruv, filtr, yangi ma'lumot yuklanganda) — 1-sahifaga qaytamiz.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const safePage = Math.min(Math.max(page, 1), pageCount);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return { page: safePage, setPage, pageCount, total, pageItems };
}
