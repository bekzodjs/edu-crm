import { useEffect, useState } from 'react';
import { MapPin, RefreshCw } from '../components/icons';
import { TeacherAttendanceApi, TeachersApi, TeacherAttendanceRecord, TeacherLiveLocation, Teacher } from '../api/client';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'hozirgina';
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hours = Math.round(mins / 60);
  return `${hours} soat oldin`;
}

export default function TeacherAttendancePage() {
  const [live, setLive] = useState<TeacherLiveLocation[]>([]);
  const [history, setHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherFilter, setTeacherFilter] = useState('');

  function load() {
    TeacherAttendanceApi.live().then((r) => setLive(r.data));
    TeacherAttendanceApi.list({ teacherId: teacherFilter || undefined }).then((r) => setHistory(r.data));
    TeachersApi.list().then((r) => setTeachers(r.data));
  }
  useEffect(load, [teacherFilter]);

  const activeCount = live.filter((l) => l.active).length;
  const { page, setPage, pageCount, total, pageItems } = usePagination(history, 15);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">O'qituvchilar davomati</h1>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw size={15} /> Yangilash
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Hozir ishda ({activeCount})</h2>
          <span className="text-xs text-slate-400">
            O'qituvchi Telegram botga /keldim orqali joylashuv yuborganda shu yerda ko'rinadi
          </span>
        </div>
        {!live.length && <p className="text-sm text-slate-400">Hali hech kim joylashuv yubormagan</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {live.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{l.teacher?.fullName || 'Noma\'lum'}</div>
                <div className={l.active ? 'badge-green mt-1' : 'badge-slate mt-1'}>
                  {l.active ? 'Ishda' : 'Ishdan ketgan'}
                </div>
                <div className="text-xs text-slate-400 mt-2">{timeAgo(l.updatedAt)}</div>
              </div>
              <a
                href={mapsLink(l.latitude, l.longitude)}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost !px-2 !py-2"
                title="Xaritada ko'rish"
              >
                <MapPin size={18} />
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="filter-bar">
        <div>
          <label className="label">O'qituvchi</label>
          <select className="input" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
            <option value="">Barchasi</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Kelish/ketish tarixi</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>O'qituvchi</th>
              <th>Turi</th>
              <th>Vaqt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((h) => (
              <tr key={h.id}>
                <td>{h.teacher?.fullName || 'Noma\'lum'}</td>
                <td>
                  <span className={h.type === 'CHECK_IN' ? 'badge-green' : 'badge-red'}>
                    {h.type === 'CHECK_IN' ? 'Keldi' : 'Ketdi'}
                  </span>
                </td>
                <td>{new Date(h.capturedAt).toLocaleString()}</td>
                <td>
                  <a href={mapsLink(h.latitude, h.longitude)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm inline-flex items-center gap-1">
                    <MapPin size={14} /> Xaritada
                  </a>
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-6">
                  Ma'lumot yo'q
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
