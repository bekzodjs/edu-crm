import { useEffect, useState } from 'react';
import { AlertTriangle } from './icons';
import { apiErrorMessage } from '../api/client';

interface Toast {
  id: number;
  message: string;
}

/**
 * Sahifa o'zi ushlamagan (try/catch qilinmagan) API xatolarini ekranning pastki
 * burchagida ko'rsatadi — aks holda saqlash muvaffaqiyatsiz bo'lganda foydalanuvchi
 * hech qanday xabar ko'rmay qolardi.
 */
export default function ErrorToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      const reason: any = event.reason;
      if (!reason?.isAxiosError) return;
      // 401 — interceptor foydalanuvchini login sahifasiga yo'naltiradi, alohida xabar shart emas.
      if (reason.response?.status === 401) return;
      event.preventDefault();
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message: apiErrorMessage(reason) }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    }
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-600 text-white px-4 py-3 shadow-lg text-sm"
          onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
