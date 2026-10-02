import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GroupsApi, TeachersApi, Group, Teacher } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

export default function Groups() {
  const { user } = useAuth();
  // TEACHER faqat o'zining guruhlarini ko'radi (backend ham shunday filtrlaydi) va
  // guruh qo'shish/tahrirlash/o'chirish huquqiga ega emas.
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', price: 0, capacity: 20, teacherId: '', room: '', salaryPct: '' as string | number });

  function load() {
    GroupsApi.list().then((r) => setGroups(r.data));
    // TEACHER uchun o'qituvchilar ro'yxati (boshqalar profili) backendda yopiq —
    // shu sahifada faqat o'zining guruhlari ko'rinadi, shuning uchun bu chaqiruv
    // faqat boshqara oladiganlar (admin) uchun kerak.
    if (canManage) TeachersApi.list().then((r) => setTeachers(r.data));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', subject: '', price: 0, capacity: 20, teacherId: teachers[0]?.id || '', room: '', salaryPct: '' });
    setShowForm(true);
  }
  function openEdit(g: Group) {
    setEditing(g);
    setForm({
      name: g.name,
      subject: g.subject || '',
      price: g.price,
      capacity: g.capacity,
      teacherId: g.teacherId,
      room: g.room || '',
      salaryPct: g.salaryPct ?? '',
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      salaryPct: form.salaryPct === '' ? (editing ? null : undefined) : Number(form.salaryPct),
    };
    if (editing) await GroupsApi.update(editing.id, payload);
    else await GroupsApi.create(payload);
    setShowForm(false);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm('Guruhni o‘chirishni tasdiqlaysizmi?')) return;
    await GroupsApi.remove(id);
    load();
  }

  function teacherName(id: string) {
    // TEACHER uchun to'liq o'qituvchilar ro'yxati yuklanmagan (huquqi yo'q) — bu holatda
    // ko'rinayotgan barcha guruhlar aynan o'zinikidir, shuning uchun o'z ismini ko'rsatamiz.
    if (!canManage && user?.teacherId === id) return user?.name || '—';
    return teachers.find((t) => t.id === id)?.fullName || '—';
  }
  function effectiveSalaryPct(g: Group) {
    if (g.salaryPct != null) return g.salaryPct;
    const t = teachers.find((tt) => tt.id === g.teacherId);
    return t?.salaryPct ?? null;
  }

  const { page, setPage, pageCount, total, pageItems } = usePagination(groups, 15);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Guruhlar</h1>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Yangi guruh
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={onSubmit} className="card mb-6 max-w-md">
          <h2 className="font-semibold mb-4">{editing ? 'Tahrirlash' : 'Yangi guruh'}</h2>
          <label className="label">Nomi</label>
          <input className="input mb-3" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="label">Fan</label>
          <input className="input mb-3" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <label className="label">Oylik narxi (so'm)</label>
          <input
            className="input mb-3"
            type="number"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          />
          <label className="label">Sig'imi</label>
          <input
            className="input mb-3"
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
          <label className="label">O'qituvchi</label>
          <select
            className="input mb-3"
            required
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
          >
            <option value="">Tanlang...</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          <label className="label">Xona</label>
          <input className="input mb-3" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          <label className="label">Maosh foizi (%) — bu guruh uchun</label>
          <input
            className="input mb-1"
            type="number"
            min={0}
            max={100}
            placeholder="Bo'sh — o'qituvchining standart foizi ishlatiladi"
            value={form.salaryPct}
            onChange={(e) => setForm({ ...form, salaryPct: e.target.value })}
          />
          <p className="text-xs text-slate-400 mb-4">
            Bitta o'qituvchi turli fan/guruhda turlicha foizda ishlashi mumkin (masalan matematikadan 40%, IT'dan 50%).
            Bo'sh qoldirsangiz, o'qituvchining "Standart maosh foizi" qiymati ishlatiladi.
          </p>
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

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nomi</th>
              <th>O'qituvchi</th>
              <th>Narxi</th>
              <th>Maosh %</th>
              <th>O'quvchilar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((g) => (
              <tr key={g.id}>
                <td>
                  <Link to={`/students?groupId=${g.id}`} className="text-brand-600 hover:underline">
                    {g.name}
                  </Link>
                </td>
                <td>{teacherName(g.teacherId)}</td>
                <td>{g.price.toLocaleString()} so'm</td>
                <td>
                  {effectiveSalaryPct(g) != null ? (
                    <span className={g.salaryPct != null ? 'badge-brand' : 'badge-slate'} title={g.salaryPct != null ? "Shu guruhga xos foiz" : "O'qituvchining standart foizi"}>
                      {effectiveSalaryPct(g)}%
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td>
                  {g.studentIds.length}/{g.capacity}
                </td>
                <td className="text-right">
                  {canManage && (
                    <>
                      <button className="text-brand-600 hover:underline mr-3 text-sm" onClick={() => openEdit(g)}>
                        Tahrirlash
                      </button>
                      <button className="text-red-600 hover:underline text-sm" onClick={() => onDelete(g.id)}>
                        O'chirish
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!groups.length && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Hozircha guruhlar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pt-2">
          <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
