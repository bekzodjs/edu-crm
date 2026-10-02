import { FormEvent, useEffect, useState } from 'react';
import { UsersApi, TeachersApi, AppUser, AppRole, Teacher } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from '../components/icons';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const ROLE_LABELS: Record<AppRole, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrator',
  RAHBAR: 'Rahbar',
  TEACHER: "O'qituvchi",
};
const ROLE_BADGES: Record<AppRole, string> = {
  SUPERADMIN: 'badge-red',
  ADMIN: 'badge-brand',
  RAHBAR: 'badge-amber',
  TEACHER: 'badge-slate',
};

const emptyForm = { name: '', phone: '', password: '', role: 'ADMIN' as AppRole, teacherId: '' };

export default function Users() {
  const { user: currentUser } = useAuth();
  const canManage = currentUser?.role === 'SUPERADMIN';
  // ADMIN to'liq boshqara olmasa ham (qo'shish/rolni o'zgartirish/o'chirish superadminga
  // xos), o'qituvchi va rahbarning parolini unutgan hollarda tezda almashtira olishi kerak.
  const canResetPassword = currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN';
  const [users, setUsers] = useState<AppUser[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [removeTarget, setRemoveTarget] = useState<AppUser | null>(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const { page, setPage, pageCount, total, pageItems } = usePagination(users, 20);

  // ADMIN (superadmin bo'lmasa) faqat "quyi" rollarning (o'qituvchi, rahbar) parolini
  // almashtira oladi — boshqa administrator yoki superadminning parolini emas.
  function canResetTargetPassword(u: AppUser) {
    if (!canResetPassword) return false;
    if (currentUser?.role === 'SUPERADMIN') return true;
    return u.role !== 'SUPERADMIN' && u.role !== 'ADMIN';
  }

  function openResetPassword(u: AppUser) {
    setResetTarget(u);
    setResetPwd('');
    setResetError('');
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');
    if (resetPwd.length < 4) {
      setResetError("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setResetSaving(true);
    try {
      await UsersApi.resetPassword(resetTarget.id, resetPwd);
      setResetTarget(null);
      setResetPwd('');
      load();
    } catch (err: any) {
      setResetError(err?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setResetSaving(false);
    }
  }

  function load() {
    UsersApi.list().then((r) => setUsers(r.data));
    TeachersApi.list().then((r) => setTeachers(r.data));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }
  function openEdit(u: AppUser) {
    setEditing(u);
    setForm({ name: u.name, phone: u.phone, password: '', role: u.role, teacherId: u.teacherId || '' });
    setError('');
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload: any = {
        name: form.name,
        phone: form.phone,
        role: form.role,
        teacherId: form.role === 'TEACHER' ? form.teacherId || undefined : undefined,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        await UsersApi.update(editing.id, payload);
      } else {
        if (!form.password) {
          setError('Parol kiritilishi shart');
          return;
        }
        await UsersApi.create({ ...payload, password: form.password });
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Xatolik yuz berdi');
    }
  }

  async function onRemove() {
    if (!removeTarget) return;
    try {
      await UsersApi.remove(removeTarget.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'O‘chirishda xatolik yuz berdi');
    }
    setRemoveTarget(null);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Sozlamalar — Foydalanuvchilar</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {canManage
              ? "Admin, rahbar va o'qituvchi login'larini shu yerdan qo'shasiz, tahrirlaysiz va o'chirasiz."
              : canResetPassword
              ? "Foydalanuvchilar ro'yxati. Yangi qo'shish/o'chirish uchun superadmin kerak, lekin o'qituvchi va rahbarning parolini shu yerdan almashtira olasiz."
              : "Foydalanuvchilar ro'yxati (faqat ko'rish — o'zgartirish uchun superadmin kerak)."}
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Yangi foydalanuvchi
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={onSubmit} className="card mb-6 max-w-md">
          <h2 className="font-semibold mb-4">{editing ? 'Tahrirlash' : 'Yangi foydalanuvchi'}</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
          <label className="label">Ism</label>
          <input
            className="input mb-3"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="label">Telefon</label>
          <input
            className="input mb-3"
            required
            placeholder="+998..."
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <label className="label">{editing ? "Yangi parol (o'zgartirmasangiz bo'sh qoldiring)" : 'Parol'}</label>
          <input
            className="input mb-3"
            type="text"
            required={!editing}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <label className="label">Rol</label>
          {/* Tizimda faqat bitta superadmin bo'ladi: uning roli o'zgarmaydi, boshqalarga superadmin roli berilmaydi. */}
          <select
            className="input mb-3"
            value={form.role}
            disabled={editing?.role === 'SUPERADMIN'}
            onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
          >
            {editing?.role === 'SUPERADMIN' && <option value="SUPERADMIN">Superadmin</option>}
            <option value="ADMIN">Administrator</option>
            <option value="RAHBAR">Rahbar</option>
            <option value="TEACHER">O'qituvchi</option>
          </select>
          {form.role === 'TEACHER' && (
            <>
              <label className="label">Bog'liq o'qituvchi profili (ixtiyoriy)</label>
              <select
                className="input mb-4"
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              >
                <option value="">Tanlanmagan</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="flex gap-2 mt-1">
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
              <th>Ism</th>
              <th>Telefon</th>
              <th>Rol</th>
              {canManage && <th>Parol</th>}
              {(canManage || canResetPassword) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.name} {u.id === currentUser?.id && <span className="text-xs text-slate-400">(siz)</span>}
                </td>
                <td className="text-slate-500">{u.phone}</td>
                <td>
                  <span className={ROLE_BADGES[u.role]}>{ROLE_LABELS[u.role]}</span>
                </td>
                {canManage && (
                <td>
                  {u.plainPassword ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
                      onClick={() => setRevealed((r) => ({ ...r, [u.id]: !r[u.id] }))}
                    >
                      <span className="font-mono">{revealed[u.id] ? u.plainPassword : '••••••••'}</span>
                      {revealed[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </td>
                )}
                {(canManage || canResetPassword) && (
                  <td className="text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <button className="text-brand-600 hover:underline mr-3 text-sm" onClick={() => openEdit(u)}>
                          Tahrirlash
                        </button>
                        <button
                          className="text-red-600 hover:underline text-sm mr-3 disabled:opacity-40 disabled:pointer-events-none"
                          disabled={u.id === currentUser?.id || u.role === 'SUPERADMIN'}
                          onClick={() => setRemoveTarget(u)}
                        >
                          O'chirish
                        </button>
                      </>
                    )}
                    {!canManage && canResetTargetPassword(u) && (
                      <button className="text-brand-600 hover:underline text-sm" onClick={() => openResetPassword(u)}>
                        Parolni almashtirish
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={canManage ? 5 : canResetPassword ? 4 : 3} className="text-center text-slate-400 py-6">
                  Foydalanuvchilar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Foydalanuvchini o'chirishni tasdiqlaysizmi?"
        description={`"${removeTarget?.name}" tizimga kira olmay qoladi.`}
        danger
        confirmLabel="Ha, o'chirish"
        onConfirm={onRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {resetTarget && (
        <div className="modal-overlay">
          <form onSubmit={onResetPassword} className="modal-panel">
            <h2 className="font-semibold mb-1">Parolni almashtirish</h2>
            <p className="text-sm text-slate-500 mb-4">
              "{resetTarget.name}" uchun yangi parol o'rnating.
            </p>
            {resetError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{resetError}</p>}
            <label className="label">Yangi parol</label>
            <input
              className="input mb-4"
              type="text"
              required
              autoFocus
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn-primary" type="submit" disabled={resetSaving}>
                {resetSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button className="btn-secondary" type="button" onClick={() => setResetTarget(null)}>
                Bekor qilish
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
