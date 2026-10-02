import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScheduleApi, GroupsApi, ScheduleSlot, Group, Lesson } from '../api/client';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export default function Schedule() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState({ groupId: '', dayOfWeek: 1, startTime: '15:00', endTime: '16:30', room: '' });
  const [genForm, setGenForm] = useState({ groupId: '', fromDate: '', toDate: '' });
  const [genResult, setGenResult] = useState<string | null>(null);

  function load() {
    GroupsApi.list().then((r) => setGroups(r.data));
    ScheduleApi.slots().then((r) => setSlots(r.data));
    const today = new Date();
    const in14 = new Date(today.getTime() + 14 * 24 * 3600 * 1000);
    ScheduleApi.lessons({ from: today.toISOString().slice(0, 10), to: in14.toISOString().slice(0, 10) }).then((r) =>
      setLessons(r.data),
    );
  }
  useEffect(load, []);

  async function onAddSlot(e: FormEvent) {
    e.preventDefault();
    if (!form.groupId) return;
    await ScheduleApi.createSlot(form);
    load();
  }

  async function onRemoveSlot(id: string) {
    await ScheduleApi.removeSlot(id);
    load();
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    const res = await ScheduleApi.generateLessons({
      groupId: genForm.groupId || undefined,
      fromDate: genForm.fromDate,
      toDate: genForm.toDate,
    });
    setGenResult(`${(res.data as any).createdCount} ta dars yaratildi.`);
    load();
  }

  function groupName(id: string) {
    return groups.find((g) => g.id === id)?.name || '—';
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dars jadvali</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Haftalik jadval slot qo'shish</h2>
          <form onSubmit={onAddSlot} className="space-y-3">
            <div>
              <label className="label">Guruh</label>
              <select
                className="input"
                required
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              >
                <option value="">Tanlang...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Hafta kuni</label>
              <select
                className="input"
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Boshlanish</label>
                <input
                  className="input"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tugash</label>
                <input className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Xona</label>
              <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
            <button className="btn-primary" type="submit">
              Qo'shish
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Darslarni generatsiya qilish</h2>
          <p className="text-xs text-slate-500 mb-3">
            Haftalik jadval asosida sana oralig'i uchun aniq darslar (Lesson) yaratiladi — davomat shularga bog'lanadi.
          </p>
          <form onSubmit={onGenerate} className="space-y-3">
            <div>
              <label className="label">Guruh (bo'sh — barchasi)</label>
              <select
                className="input"
                value={genForm.groupId}
                onChange={(e) => setGenForm({ ...genForm, groupId: e.target.value })}
              >
                <option value="">Barcha guruhlar</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Boshlanish sanasi</label>
                <input
                  className="input"
                  type="date"
                  required
                  value={genForm.fromDate}
                  onChange={(e) => setGenForm({ ...genForm, fromDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tugash sanasi</label>
                <input
                  className="input"
                  type="date"
                  required
                  value={genForm.toDate}
                  onChange={(e) => setGenForm({ ...genForm, toDate: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary" type="submit">
              Generatsiya qilish
            </button>
            {genResult && <p className="text-sm text-green-600">{genResult}</p>}
          </form>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold mb-3">Haftalik jadval slotlari</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Guruh</th>
              <th>Kun</th>
              <th>Vaqt</th>
              <th>Xona</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id}>
                <td>{groupName(s.groupId)}</td>
                <td>{DAYS[s.dayOfWeek]}</td>
                <td>
                  {s.startTime}–{s.endTime}
                </td>
                <td>{s.room || '—'}</td>
                <td className="text-right">
                  <button className="text-red-600 hover:underline text-sm" onClick={() => onRemoveSlot(s.id)}>
                    O'chirish
                  </button>
                </td>
              </tr>
            ))}
            {!slots.length && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  Jadval slotlari yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Yaqin 14 kunlik darslar</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Guruh</th>
              <th>Vaqt</th>
              <th>Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.date).toLocaleDateString()}</td>
                <td>{groupName(l.groupId)}</td>
                <td>
                  {l.startTime}–{l.endTime}
                </td>
                <td>{l.status === 'COMPLETED' ? "O'tildi" : l.status === 'CANCELLED' ? 'Bekor qilindi' : 'Rejalashtirilgan'}</td>
                <td className="text-right">
                  <Link to={`/attendance?lessonId=${l.id}`} className="text-brand-600 hover:underline text-sm">
                    Davomat belgilash
                  </Link>
                </td>
              </tr>
            ))}
            {!lessons.length && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  Darslar topilmadi. Avval yuqorida generatsiya qiling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
