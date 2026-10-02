import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StudentsApi, PaymentsApi, TelegramApi, GradesApi, Student, Payment, GradeSummary } from '../api/client';
import { Star, Percent } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  PAYME: 'Payme',
  CLICK: 'Click',
  OTHER: 'Boshqa',
};
const METHOD_BADGES: Record<string, string> = {
  CASH: 'badge-slate',
  CARD: 'badge-brand',
  PAYME: 'badge-green',
  CLICK: 'badge-amber',
  OTHER: 'badge-slate',
};

export default function StudentDetail() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'CASH', periodMonth: currentPeriod(), note: '' });
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<boolean | null>(null);
  const [gradeSummary, setGradeSummary] = useState<GradeSummary | null>(null);

  function load() {
    if (!id) return;
    StudentsApi.get(id).then((r) => setStudent(r.data as any));
  }
  useEffect(load, [id]);
  useEffect(() => {
    TelegramApi.status().then((r) => setBotStatus(r.data.enabled));
  }, []);
  useEffect(() => {
    if (!id) return;
    GradesApi.summary(id).then((r) => setGradeSummary(r.data));
  }, [id]);

  async function onAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    await PaymentsApi.create({ studentId: id, ...payForm });
    setPayForm({ amount: 0, method: 'CASH', periodMonth: currentPeriod(), note: '' });
    load();
  }

  async function onGenerateLink() {
    if (!id) return;
    const res = await TelegramApi.createLink(id);
    setLinkCode((res.data as any).linkCode);
  }

  const paymentsPage = usePagination(student?.payments || [], 10);
  const attendancesPage = usePagination(student?.attendances || [], 10);

  if (!student) return <p className="text-slate-400">Yuklanmoqda...</p>;

  const payments = student.payments || [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <Link to="/students" className="text-sm text-brand-600 hover:underline">
        ← O'quvchilarga qaytish
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-semibold">{student.fullName}</h1>
        <div className="flex items-center gap-2">
          {!!student.discountPct && (
            <span className="badge-amber flex items-center gap-1">
              <Percent size={13} /> {student.discountPct}% chegirma
            </span>
          )}
          <span className={student.active ? 'badge-green' : 'badge-slate'}>{student.active ? 'Faol' : 'Nofaol'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Ma'lumotlar</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Telefon</dt>
              <dd>{student.phone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Ota-ona</dt>
              <dd>{student.parentName || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Ota-ona telefoni</dt>
              <dd>{student.parentPhone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Guruhlar</dt>
              <dd className="text-right">{(student.groups || []).map((g) => g.name).join(', ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Markazga qo'shilgan sana</dt>
              <dd>{student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Chegirma</dt>
              <dd>{student.discountPct ? `${student.discountPct}%` : "Yo'q"}</dd>
            </div>
          </dl>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <h3 className="font-semibold text-sm mb-2">Telegram bog'lanishi</h3>
            {botStatus === false && (
              <p className="text-xs text-amber-600 mb-2">
                Bot hozircha o'chirilgan (.env faylida TELEGRAM_BOT_TOKEN kiritilmagan).
              </p>
            )}
            <button className="btn-secondary text-sm" onClick={onGenerateLink}>
              Bog'lash kodi yaratish
            </button>
            {linkCode && (
              <p className="text-sm mt-3 bg-slate-50 rounded-lg p-3">
                Ota-onaga shu buyruqni Telegram botga yuborishni ayting:
                <br />
                <code className="text-brand-700 font-mono">/start {linkCode}</code>
              </p>
            )}
          </div>
        </div>

        {canManage && (
        <div className="card">
          <h2 className="font-semibold mb-3">To'lov qo'shish</h2>
          <form onSubmit={onAddPayment} className="space-y-3">
            <div>
              <label className="label">Summa (so'm)</label>
              <input
                className="input"
                type="number"
                required
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Usul</label>
                <select
                  className="input"
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                >
                  <option value="CASH">Naqd</option>
                  <option value="CARD">Karta</option>
                  <option value="PAYME">Payme</option>
                  <option value="CLICK">Click</option>
                  <option value="OTHER">Boshqa</option>
                </select>
              </div>
              <div>
                <label className="label">Oy (YYYY-MM)</label>
                <input
                  type="month"
                  className="input"
                  value={payForm.periodMonth}
                  onChange={(e) => setPayForm({ ...payForm, periodMonth: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-primary" type="submit">
              To'lovni qayd qilish
            </button>
          </form>
        </div>
        )}
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">To'lovlar tarixi</h2>
          <span className="text-sm text-slate-500">
            Jami to'langan: <strong>{totalPaid.toLocaleString()} so'm</strong>
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Oy</th>
              <th>Summa</th>
              <th>Usul</th>
              <th>Sana</th>
            </tr>
          </thead>
          <tbody>
            {paymentsPage.pageItems.map((p: Payment) => (
              <tr key={p.id}>
                <td>{p.periodMonth}</td>
                <td className="font-medium">{p.amount.toLocaleString()} so'm</td>
                <td>
                  <span className={METHOD_BADGES[p.method] || 'badge-slate'}>{METHOD_LABELS[p.method] || p.method}</span>
                </td>
                <td className="text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td colSpan={4} className="text-slate-400 py-3">
                  To'lovlar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pt-2">
          <Pagination page={paymentsPage.page} pageCount={paymentsPage.pageCount} total={paymentsPage.total} onChange={paymentsPage.setPage} />
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Star size={18} className="text-amber-500" /> Baholar
          </h2>
        </div>
        {gradeSummary ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Bu hafta</div>
                <div className="text-xl font-semibold">{gradeSummary.week.average || 0}</div>
                <div className="text-xs text-slate-400">{gradeSummary.week.count} ta baho</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Bu oy</div>
                <div className="text-xl font-semibold">{gradeSummary.month.average || 0}</div>
                <div className="text-xs text-slate-400">{gradeSummary.month.count} ta baho</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {gradeSummary.recent.map((g) => (
                <span
                  key={g.id}
                  className={g.score >= 8 ? 'badge-green' : g.score >= 5 ? 'badge-amber' : 'badge-red'}
                  title={new Date(g.createdAt).toLocaleDateString()}
                >
                  {g.score}
                </span>
              ))}
              {!gradeSummary.recent.length && <span className="text-slate-400 text-sm">Hali baho yo'q</span>}
            </div>
          </>
        ) : (
          <p className="text-slate-400 text-sm">Yuklanmoqda...</p>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">So'nggi davomat</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Holat</th>
            </tr>
          </thead>
          <tbody>
            {attendancesPage.pageItems.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.markedAt).toLocaleDateString()}</td>
                <td>
                  {a.status === 'PRESENT' && <span className="text-green-600">Keldi</span>}
                  {a.status === 'ABSENT' && <span className="text-red-600">Kelmadi</span>}
                  {a.status === 'LATE' && <span className="text-amber-600">Kechikdi</span>}
                  {a.status === 'EXCUSED' && <span className="text-slate-500">Sababli</span>}
                </td>
              </tr>
            ))}
            {!student.attendances?.length && (
              <tr>
                <td colSpan={2} className="text-slate-400 py-3">
                  Davomat ma'lumoti yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pt-2">
          <Pagination page={attendancesPage.page} pageCount={attendancesPage.pageCount} total={attendancesPage.total} onChange={attendancesPage.setPage} />
        </div>
      </div>
    </div>
  );
}
