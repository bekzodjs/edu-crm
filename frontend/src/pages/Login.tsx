import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Phone, Eye, EyeOff, Loader2 } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
      navigate('/');
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Kirishda xatolik yuz berdi'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Chap tomon — brend paneli */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <GraduationCap size={26} />
          Edu CRM
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-snug mb-4">
            O'quv markazingizni bitta joydan boshqaring
          </h1>
          <p className="text-brand-100 text-sm leading-relaxed">
            O'quvchilar, guruhlar, dars jadvali, davomat, to'lov va qarzdorlik — barchasi bitta
            tizimda. Telegram bot orqali ota-onalar va o'qituvchilar bilan avtomatik aloqa.
          </p>
        </div>

        <div className="relative text-xs text-brand-100/80">© {new Date().getFullYear()} Edu CRM</div>
      </div>

      {/* O'ng tomon — login forma */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 text-brand-700 font-semibold text-lg mb-8 justify-center">
            <GraduationCap size={24} />
            Edu CRM
          </div>

          <h2 className="text-xl font-semibold text-slate-800 mb-1">Xush kelibsiz</h2>
          <p className="text-sm text-slate-500 mb-6">Davom etish uchun tizimga kiring</p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <label className="label">Telefon</label>
          <div className="relative mb-4">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998901234567"
              autoFocus
            />
          </div>

          <label className="label">Parol</label>
          <div className="relative mb-6">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9 !pr-9"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Kirish'}
          </button>

          <p className="text-xs text-slate-400 mt-5 text-center">
            Birinchi marta ishlatyapsizmi? Backend'da <code>npm run seed</code> buyrug'i orqali
            admin yarating.
          </p>
        </form>
      </div>
    </div>
  );
}
