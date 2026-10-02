import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScheduleApi, AttendanceApi, GroupsApi, Lesson, Group } from '../api/client';

const STATUS_OPTIONS: { value: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Keldi', color: 'bg-green-100 text-green-700' },
  { value: 'ABSENT', label: 'Kelmadi', color: 'bg-red-100 text-red-700' },
  { value: 'LATE', label: 'Kechikdi', color: 'bg-amber-100 text-amber-700' },
  { value: 'EXCUSED', label: 'Sababli', color: 'bg-slate-200 text-slate-700' },
];

export default function Attendance() {
  const [params, setParams] = useSearchParams();
  const lessonId = params.get('lessonId') || '';

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState(params.get('groupId') || '');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    GroupsApi.list().then((r) => setGroups(r.data));
  }, []);

  useEffect(() => {
    if (!groupId) {
      setLessons([]);
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.delete('lessonId');
        if (groupId) next.set('groupId', groupId);
        else next.delete('groupId');
        return next;
      });
      return;
    }
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    to.setDate(to.getDate() + 14);
    ScheduleApi.lessons({
      groupId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).then((r) => {
      const sorted = [...r.data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setLessons(sorted);
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLesson = sorted.find((l) => l.date.slice(0, 10) === todayStr);
      const past = sorted.filter((l) => l.date.slice(0, 10) <= todayStr);
      const pick = todayLesson?.id || past[past.length - 1]?.id || sorted[0]?.id || '';
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set('groupId', groupId);
        if (pick) next.set('lessonId', pick);
        else next.delete('lessonId');
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (!lessonId) {
      setLesson(null);
      return;
    }
    ScheduleApi.lesson(lessonId).then((r) => {
      setLesson(r.data as any);
      const initial: Record<string, string> = {};
      const initialMinutes: Record<string, number> = {};
      const attendances = (r.data as any).attendances || [];
      for (const s of (r.data as any).students || []) {
        const existing = attendances.find((a: any) => a.studentId === s.id);
        initial[s.id] = existing?.status || 'PRESENT';
        if (existing?.lateMinutes) initialMinutes[s.id] = existing.lateMinutes;
      }
      setStatuses(initial);
      setLateMinutes(initialMinutes);
      setSaved(false);
    });
  }, [lessonId]);

  function groupName(id: string) {
    return groups.find((g) => g.id === id)?.name || '—';
  }

  function onSelectGroup(id: string) {
    setGroupId(id);
  }

  function onSelectLesson(id: string) {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (id) next.set('lessonId', id);
      else next.delete('lessonId');
      return next;
    });
  }

  const stats = useMemo(() => {
    const students = lesson?.students || [];
    const total = students.length;
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const s of students) {
      const st = (statuses[s.id] || 'PRESENT') as keyof typeof counts;
      if (counts[st] !== undefined) counts[st]++;
    }
    const cameCount = counts.PRESENT + counts.LATE;
    const rate = total ? Math.round((cameCount / total) * 100) : 0;
    return { total, counts, cameCount, rate };
  }, [lesson, statuses]);

  const circleColor =
    stats.total === 0
      ? 'bg-slate-300'
      : stats.rate >= 80
      ? 'bg-green-500'
      : stats.rate >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  async function onSave() {
    if (!lesson) return;
    setSaving(true);
    try {
      await AttendanceApi.markBulk({
        lessonId: lesson.id,
        entries: Object.entries(statuses).map(([studentId, status]) => ({
          studentId,
          status,
          lateMinutes: status === 'LATE' ? lateMinutes[studentId] || undefined : undefined,
        })),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Davomat</h1>

      <div className="card mb-6 max-w-md">
        <label className="label">1. Fan / guruhni tanlang</label>
        <select className="input mb-4" value={groupId} onChange={(e) => onSelectGroup(e.target.value)}>
          <option value="">Tanlang...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.subject ? ` — ${g.subject}` : ''}
            </option>
          ))}
        </select>

        <label className="label">2. Sana (dars kuni)</label>
        <select
          className="input"
          value={lessonId}
          onChange={(e) => onSelectLesson(e.target.value)}
          disabled={!groupId || !lessons.length}
        >
          <option value="">{!groupId ? 'Avval guruhni tanlang' : 'Tanlang...'}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {new Date(l.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} ({l.startTime})
            </option>
          ))}
        </select>
        {groupId && !lessons.length && (
          <p className="text-xs text-slate-400 mt-2">
            Darslar yo'q. Avval "Dars jadvali" bo'limida haftalik jadval qo'shib, darslarni generatsiya qiling.
          </p>
        )}
      </div>

      {lesson && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {groupName(lesson.groupId)} — {new Date(lesson.date).toLocaleDateString()} ({lesson.startTime}–{lesson.endTime})
            </h2>
            <button className="btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
          {saved && <p className="text-sm text-green-600 mb-3">Davomat saqlandi. Kelmaganlar ota-onasiga xabar yuborildi.</p>}

          {stats.total > 0 && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-wrap items-center gap-4">
              <div
                className={`shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md ${circleColor}`}
              >
                {stats.rate}%
              </div>
              <div className="min-w-[180px]">
                <p className="font-semibold text-slate-700">
                  {stats.cameCount}/{stats.total} o'quvchi darsga keldi
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Keldi {stats.counts.PRESENT}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Kechikdi {stats.counts.LATE}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Kelmadi {stats.counts.ABSENT}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Sababli {stats.counts.EXCUSED}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                  {stats.counts.PRESENT > 0 && (
                    <div className="h-full bg-green-500" style={{ width: `${(stats.counts.PRESENT / stats.total) * 100}%` }} />
                  )}
                  {stats.counts.LATE > 0 && (
                    <div className="h-full bg-amber-500" style={{ width: `${(stats.counts.LATE / stats.total) * 100}%` }} />
                  )}
                  {stats.counts.EXCUSED > 0 && (
                    <div className="h-full bg-slate-400" style={{ width: `${(stats.counts.EXCUSED / stats.total) * 100}%` }} />
                  )}
                  {stats.counts.ABSENT > 0 && (
                    <div className="h-full bg-red-500" style={{ width: `${(stats.counts.ABSENT / stats.total) * 100}%` }} />
                  )}
                </div>
              </div>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>O'quvchi</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {(lesson.students || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.fullName}</td>
                  <td>
                    <div className="flex gap-1.5 items-center flex-wrap">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatuses((st) => ({ ...st, [s.id]: opt.value }))}
                          className={`text-xs rounded-full px-2.5 py-1 border ${
                            statuses[s.id] === opt.value ? opt.color + ' border-transparent' : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {statuses[s.id] === 'LATE' && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="number"
                            min={1}
                            className="input !w-16 !py-1 !px-2"
                            placeholder="min"
                            value={lateMinutes[s.id] ?? ''}
                            onChange={(e) =>
                              setLateMinutes((lm) => ({ ...lm, [s.id]: Number(e.target.value) }))
                            }
                          />
                          minut kechikdi
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!lesson.students?.length && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-400 py-6">
                    Bu guruhda o'quvchi yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
