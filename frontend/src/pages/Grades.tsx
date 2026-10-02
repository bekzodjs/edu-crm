import { useEffect, useState } from 'react';
import { GroupsApi, GradesApi, ScheduleApi, Group, Grade, Student, Lesson } from '../api/client';
import { Star, Check } from '../components/icons';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

const SCORE_OPTIONS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function scoreBadge(score: number) {
  if (score >= 8) return 'badge-green';
  if (score >= 5) return 'badge-amber';
  return 'badge-red';
}

export default function GradesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState('');

  useEffect(() => {
    GroupsApi.list().then((r) => {
      setGroups(r.data);
      if (r.data.length) setGroupId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!groupId) {
      setStudents([]);
      setGrades([]);
      return;
    }
    // Diqqat: GroupsApi.list() (ro'yxat) guruhning studentIds'ini beradi, lekin to'liq
    // "students" massivini to'ldirmaydi (faqat GroupsApi.get bitta guruh uchun to'ldiradi) —
    // shuning uchun o'quvchilarni aynan shu yerdan, alohida so'rov bilan olamiz.
    GroupsApi.get(groupId).then((r) => setStudents((r.data as any).students || []));
    GradesApi.list({ groupId }).then((r) => setGrades(r.data));
  }, [groupId]);

  // Guruhning haqiqiy dars kunlariga (masalan toq yoki juft kunlar — dars jadvalida
  // qanday generatsiya qilingan bo'lsa) mos ravishda sanalar ro'yxatini yuklaymiz —
  // o'qituvchi bahoni aynan qaysi dars kuniga qo'yayotganini tanlaydi.
  useEffect(() => {
    if (!groupId) {
      setLessons([]);
      setLessonId('');
      return;
    }
    // Faqat shu haftaning dars kunlarini ko'rsatamiz (masalan haftada 3 kun bo'lsa —
    // ro'yxatda ham aynan shu 3 ta sana chiqadi, ortiqcha eski/kelajak haftalar emas).
    const now = new Date();
    const dow = now.getDay(); // 0=Yakshanba
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const from = new Date(now);
    from.setDate(now.getDate() + mondayOffset);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    ScheduleApi.lessons({
      groupId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).then((r) => {
      const sorted = [...r.data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setLessons(sorted);
      const todayStr = new Date().toISOString().slice(0, 10);
      // Bugungi darsni topamiz, bo'lmasa eng so'nggi o'tgan (yoki eng yaqin) darsni tanlaymiz.
      const todayLesson = sorted.find((l) => l.date.slice(0, 10) === todayStr);
      const past = sorted.filter((l) => l.date.slice(0, 10) <= todayStr);
      setLessonId(todayLesson?.id || past[past.length - 1]?.id || sorted[0]?.id || '');
    });
  }, [groupId]);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const { page, setPage, pageCount, total, pageItems } = usePagination(students, 6);

  function recentForStudent(studentId: string) {
    return grades.filter((g) => g.studentId === studentId).slice(0, 5);
  }

  async function onGive(studentId: string) {
    const score = scores[studentId];
    if (!score || !selectedGroup) return;
    setSaving(studentId);
    try {
      await GradesApi.create({
        studentId,
        groupId,
        teacherId: selectedGroup.teacherId,
        lessonId: lessonId || undefined,
        score,
        comment: comments[studentId]?.trim() || undefined,
      });
      const r = await GradesApi.list({ groupId });
      setGrades(r.data);
      setSavedFor(studentId);
      setComments((c) => ({ ...c, [studentId]: '' }));
      setTimeout(() => setSavedFor((cur) => (cur === studentId ? null : cur)), 2000);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Baholar</h1>

      <div className="card mb-6 max-w-md">
        <label className="label">Guruhni tanlang</label>
        <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {!groups.length && <option value="">Guruhlar yo'q</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <label className="label mt-3">Sana (dars kuni)</label>
        <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!lessons.length}>
          {!lessons.length && <option value="">Bu guruh uchun darslar topilmadi</option>}
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {new Date(l.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: '2-digit' })} ·{' '}
              {l.startTime}
            </option>
          ))}
        </select>
        {!lessons.length && groupId && (
          <p className="text-xs text-slate-400 mt-2">
            Darslar yo'q. Avval "Dars jadvali" bo'limida haftalik jadval qo'shib, darslarni generatsiya qiling.
          </p>
        )}
      </div>

      {groupId && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center gap-2">
            <Star size={18} className="text-amber-500" />
            O'quvchilarga baho qo'yish
          </div>
          <div className="divide-y divide-slate-100">
            {!students.length && <div className="text-center text-slate-400 py-8">Bu guruhda o'quvchi yo'q</div>}
            {pageItems.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="font-medium">{s.fullName}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SCORE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScores((sc) => ({ ...sc, [s.id]: n }))}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold border transition-colors ${
                          scores[s.id] === n
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      className="input !w-40 !py-1.5 ml-2"
                      placeholder="Izoh (ixtiyoriy)"
                      value={comments[s.id] || ''}
                      onChange={(e) => setComments((c) => ({ ...c, [s.id]: e.target.value }))}
                    />
                    <button
                      className="btn-primary !py-1.5"
                      disabled={!scores[s.id] || saving === s.id}
                      onClick={() => onGive(s.id)}
                    >
                      {saving === s.id ? '...' : 'Qo\'yish'}
                    </button>
                    {savedFor === s.id && (
                      <span className="text-green-600 text-xs flex items-center gap-1">
                        <Check size={14} /> Saqlandi
                      </span>
                    )}
                  </div>
                </div>
                {!!recentForStudent(s.id).length && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-400">So'nggi baholar:</span>
                    {recentForStudent(s.id).map((g) => (
                      <span key={g.id} className={scoreBadge(g.score)} title={new Date(g.createdAt).toLocaleDateString()}>
                        {g.score}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
