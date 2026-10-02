import { Fragment, FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, X, Phone as PhoneIcon, Search } from '../components/icons';
import { TeachersApi, TelegramApi, Teacher } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import Profile from './Profile';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];
function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Teachers() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  // O'qituvchilar ro'yxati (boshqalar profili) TEACHER uchun backendda yopiq — nav'da
  // ham yashirilgan, lekin to'g'ridan-to'g'ri link orqali kirib qolishning oldini olish
  // uchun bu yerda ham o'z profiliga ("Mening profilim") yo'naltiramiz.
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', subject: '', salaryPct: '' as string | number, active: true });
  const [linkCode, setLinkCode] = useState<{ teacherId: string; code: string } | null>(null);

  function load() {
    if (user?.role === 'TEACHER') return;
    TeachersApi.list().then((r) => setTeachers(r.data));
  }
  useEffect(load, [user?.role]);

  // Ism (yoki familiya) bosh harfi bilan, yoxud telefon raqami bo'yicha filtr.
  const filteredTeachers = teachers.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const nameMatch = t.fullName
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q));
    const phoneMatch = t.phone?.toLowerCase().replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
    return nameMatch || phoneMatch;
  });

  // MUHIM: hook'lar (usePagination shu jumladan) har doim shartsiz, komponent tepasida
  // chaqirilishi kerak — shuning uchun TEACHER uchun "Mening profilim"ga almashtirish
  // BARCHA hook'lar chaqirilgandan KEYIN, JSX return'dan oldin amalga oshiriladi
  // (aks holda React "Rendered fewer hooks than expected" xatosini beradi).
  const { page, setPage, pageCount, total, pageItems } = usePagination(filteredTeachers, 15);

  if (user?.role === 'TEACHER') {
    return <Profile />;
  }

  function openCreate() {
    setEditing(null);
    setForm({ fullName: '', phone: '', subject: '', salaryPct: '', active: true });
    setShowForm(true);
  }
  function openEdit(t: Teacher) {
    setEditing(t);
    setForm({ fullName: t.fullName, phone: t.phone, subject: t.subject || '', salaryPct: t.salaryPct ?? '', active: t.active });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: any = {
      fullName: form.fullName,
      phone: form.phone,
      subject: form.subject || undefined,
      salaryPct: form.salaryPct === '' ? undefined : Number(form.salaryPct),
    };
    if (editing) await TeachersApi.update(editing.id, { ...payload, active: form.active });
    else await TeachersApi.create(payload);
    setShowForm(false);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("O'qituvchini o'chirishni tasdiqlaysizmi?")) return;
    await TeachersApi.remove(id);
    load();
  }

  async function onGenerateLink(teacherId: string) {
    const res = await TelegramApi.createTeacherLink(teacherId);
    setLinkCode({ teacherId, code: (res.data as any).linkCode });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">O'qituvchilar</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filteredTeachers.length} / {teachers.length} ta o'qituvchi</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Yangi o'qituvchi
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="flex-1 min-w-[240px]">
          <label className="label">Qidirish</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9"
              placeholder="Ism, familiya bosh harfi yoki telefon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showForm && canManage && (
        <form onSubmit={onSubmit} className="card mb-6 max-w-md">
          <h2 className="font-semibold mb-4">{editing ? 'Tahrirlash' : "Yangi o'qituvchi"}</h2>
          <label className="label">F.I.Sh.</label>
          <input
            className="input mb-3"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <label className="label">Telefon</label>
          <input
            className="input mb-3"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Fan/yo'nalish</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Standart maosh foizi (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={form.salaryPct}
                onChange={(e) => setForm({ ...form, salaryPct: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">
                Agar o'qituvchi turli guruhda turlicha foizda ishlasa (masalan 40% va 50%), buni har bir guruh
                sahifasida alohida belgilash mumkin — bu yerdagi qiymat faqat standart/asosiy holat uchun.
              </p>
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Faol
            </label>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">
              Saqlash
            </button>
            <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>O'qituvchi</th>
              <th>Telefon</th>
              <th>Fan</th>
              <th>Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t) => (
              <Fragment key={t.id}>
                <tr>
                  <td>
                    <Link to={`/teachers/${t.id}`} className="flex items-center gap-3 group">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(t.id)}`}
                      >
                        {initials(t.fullName)}
                      </div>
                      <span className="font-medium text-slate-700 group-hover:text-brand-600 group-hover:underline">
                        {t.fullName}
                      </span>
                    </Link>
                  </td>
                  <td className="text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <PhoneIcon size={13} />
                      {t.phone}
                    </span>
                  </td>
                  <td>{t.subject ? <span className="badge-brand">{t.subject}</span> : <span className="text-slate-400">—</span>}</td>
                  <td>
                    <span className={t.active ? 'badge-green' : 'badge-slate'}>{t.active ? 'Faol' : 'Nofaol'}</span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link to={`/teachers/${t.id}`} className="text-brand-600 hover:underline mr-3 text-sm">
                      Profil
                    </Link>
                    <button
                      className="text-brand-600 hover:underline mr-3 text-sm inline-flex items-center gap-1"
                      onClick={() => onGenerateLink(t.id)}
                    >
                      <Send size={13} /> Telegram bog'lash
                    </button>
                    {canManage && (
                      <>
                        <button className="text-brand-600 hover:underline mr-3 text-sm" onClick={() => openEdit(t)}>
                          Tahrirlash
                        </button>
                        <button className="text-red-600 hover:underline text-sm" onClick={() => onDelete(t.id)}>
                          O'chirish
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {linkCode?.teacherId === t.id && (
                  <tr>
                    <td colSpan={5} className="bg-brand-50/60">
                      <div className="flex items-center justify-between py-2 px-1 text-sm">
                        <span>
                          O'qituvchiga Telegram botga shu buyruqni yuborishni ayting:{' '}
                          <code className="text-brand-700 font-mono bg-white px-2 py-0.5 rounded border border-brand-200">
                            /start {linkCode.code}
                          </code>
                        </span>
                        <button className="btn-ghost !p-1.5" onClick={() => setLinkCode(null)}>
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!filteredTeachers.length && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  {teachers.length ? 'Mos o\'qituvchi topilmadi' : "Hozircha o'qituvchilar yo'q"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
