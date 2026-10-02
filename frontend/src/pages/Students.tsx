import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from '../components/icons';
import { StudentsApi, GroupsApi, Student, Group } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';

export default function Students() {
  const { user } = useAuth();
  // TEACHER faqat o'zi dars beradigan guruhlardagi o'quvchilarni ko'radi (buni backend
  // ham cheklaydi) va o'quvchi qo'shish/tahrirlash/o'chirish huquqiga ega emas.
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const [params] = useSearchParams();
  const groupFilterFromUrl = params.get('groupId') || '';

  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState(groupFilterFromUrl);
  const [onlyActive, setOnlyActive] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    address: '',
    groupIds: [] as string[],
    active: true,
  });

  function load() {
    StudentsApi.list({
      search: search || undefined,
      groupId: groupFilter || undefined,
      onlyActive: onlyActive ? 'true' : undefined,
      page,
      limit,
    }).then((r) => {
      setStudents(r.data.data);
      setTotal(r.data.total);
      setPageCount(r.data.pageCount);
    });
    GroupsApi.list().then((r) => setGroups(r.data));
  }
  useEffect(load, [search, groupFilter, onlyActive, page]);
  useEffect(() => setPage(1), [search, groupFilter, onlyActive]);

  function openCreate() {
    setEditing(null);
    setForm({ fullName: '', phone: '', parentName: '', parentPhone: '', address: '', groupIds: [], active: true });
    setShowForm(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      fullName: s.fullName,
      phone: s.phone || '',
      parentName: s.parentName || '',
      parentPhone: s.parentPhone || '',
      address: s.address || '',
      groupIds: s.groupIds,
      active: s.active,
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editing) await StudentsApi.update(editing.id, form);
    else await StudentsApi.create(form);
    setShowForm(false);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("O'quvchini o'chirishni tasdiqlaysizmi?")) return;
    await StudentsApi.remove(id);
    load();
  }

  async function onToggleActive(s: Student) {
    if (!canManage) return;
    await StudentsApi.update(s.id, { active: !s.active });
    load();
  }

  function toggleGroup(id: string) {
    setForm((f) => ({
      ...f,
      groupIds: f.groupIds.includes(id) ? f.groupIds.filter((g) => g !== id) : [...f.groupIds, id],
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">O'quvchilar</h1>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Yangi o'quvchi
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Qidirish</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9"
              placeholder="Ism yoki telefon (o'quvchi/ota-ona) bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="label">Guruh</label>
          <select className="input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 accent-brand-600"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          Faqat faollar
        </label>
      </div>

      {showForm && canManage && (
        <form onSubmit={onSubmit} className="card mb-6 max-w-lg">
          <h2 className="font-semibold mb-4">{editing ? 'Tahrirlash' : "Yangi o'quvchi"}</h2>
          <label className="label">F.I.Sh.</label>
          <input
            className="input mb-3"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <label className="label">Telefon</label>
          <input className="input mb-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Ota-ona ismi</label>
              <input
                className="input"
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ota-ona telefoni</label>
              <input
                className="input"
                placeholder="+998..."
                value={form.parentPhone}
                onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
              />
            </div>
          </div>
          <label className="label">Manzil</label>
          <input
            className="input mb-3"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <label className="label">Guruhlar</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {groups.map((g) => (
              <button
                type="button"
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`text-xs rounded-full px-3 py-1.5 border ${
                  form.groupIds.includes(g.id)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {g.name}
              </button>
            ))}
            {!groups.length && <span className="text-xs text-slate-400">Avval guruh yarating</span>}
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-brand-600"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
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
              <th>F.I.Sh.</th>
              <th>Ota-ona telefoni</th>
              <th>Guruhlar</th>
              <th>Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/students/${s.id}`} className="text-brand-600 hover:underline font-medium">
                    {s.fullName}
                  </Link>
                </td>
                <td>{s.parentPhone || '—'}</td>
                <td>{s.groupIds.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ') || '—'}</td>
                <td>
                  {canManage ? (
                    <button onClick={() => onToggleActive(s)} title="Holatni almashtirish">
                      <span className={s.active ? 'badge-green' : 'badge-slate'}>{s.active ? 'Faol' : 'Nofaol'}</span>
                    </button>
                  ) : (
                    <span className={s.active ? 'badge-green' : 'badge-slate'}>{s.active ? 'Faol' : 'Nofaol'}</span>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <button className="text-brand-600 hover:underline mr-3 text-sm" onClick={() => openEdit(s)}>
                        Tahrirlash
                      </button>
                      <button className="text-red-600 hover:underline text-sm" onClick={() => onDelete(s.id)}>
                        O'chirish
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  O'quvchilar topilmadi
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
