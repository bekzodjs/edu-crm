import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AttendanceApi, GroupsApi, Group, AttendanceReportRow } from '../api/client';
import { ClipboardCheck } from '../components/icons';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceReport() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<AttendanceReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GroupsApi.list().then((r) => setGroups(r.data));
  }, []);

  function load() {
    setLoading(true);
    AttendanceApi.report({ from, to, groupId: groupId || undefined })
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(load, [from, to, groupId]);

  const totals = (rows || []).reduce(
    (acc, r) => {
      acc.present += r.present;
      acc.absent += r.absent;
      acc.late += r.late;
      acc.excused += r.excused;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 },
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Davomat hisoboti</h1>

      <div className="filter-bar">
        <div>
          <label className="label">Sanadan</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Sanagacha</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Guruh</label>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 max-w-2xl">
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Keldi</div>
          <div className="text-2xl font-semibold text-green-600">{totals.present}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Kelmadi</div>
          <div className="text-2xl font-semibold text-red-600">{totals.absent}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Kechikdi</div>
          <div className="text-2xl font-semibold text-amber-600">{totals.late}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Sababli</div>
          <div className="text-2xl font-semibold text-slate-500">{totals.excused}</div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center gap-2">
          <ClipboardCheck size={18} />
          O'quvchilar bo'yicha
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>O'quvchi</th>
              <th>Keldi</th>
              <th>Kelmadi</th>
              <th>Kechikdi</th>
              <th>Kechikish (jami minut)</th>
              <th>Sababli</th>
              <th>Ota-ona telefoni</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-6">
                  Yuklanmoqda...
                </td>
              </tr>
            )}
            {!loading &&
              rows?.map((r) => (
                <tr key={r.studentId}>
                  <td>
                    <Link to={`/students/${r.studentId}`} className="text-brand-600 hover:underline">
                      {r.fullName}
                    </Link>
                  </td>
                  <td className="text-green-600">{r.present}</td>
                  <td className="text-red-600 font-medium">{r.absent}</td>
                  <td className="text-amber-600 font-medium">{r.late}</td>
                  <td>{r.lateMinutesTotal ? `${r.lateMinutesTotal} min` : '—'}</td>
                  <td className="text-slate-500">{r.excused}</td>
                  <td>{r.parentPhone || '—'}</td>
                </tr>
              ))}
            {!loading && rows && !rows.length && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-6">
                  Shu davrda davomat ma'lumoti yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
