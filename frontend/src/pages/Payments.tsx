import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PaymentsApi, StudentsApi, Payment, Student } from '../api/client';
import Pagination from '../components/Pagination';

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

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const limit = 25;

  const [students, setStudents] = useState<Student[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [method, setMethod] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', amount: 0, method: 'CASH', periodMonth: currentPeriod(), note: '' });

  function load() {
    PaymentsApi.list({ periodMonth: period || undefined, method: method || undefined, page, limit }).then((r) => {
      setPayments(r.data.data);
      setTotal(r.data.total);
      setPageCount(r.data.pageCount);
    });
    StudentsApi.list({ limit: 500 }).then((r) => setStudents(r.data.data));
  }
  useEffect(load, [period, method, page]);
  useEffect(() => setPage(1), [period, method]);

  function findStudent(id: string) {
    return students.find((s) => s.id === id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await PaymentsApi.create(form);
    setShowForm(false);
    setForm({ studentId: '', amount: 0, method: 'CASH', periodMonth: currentPeriod(), note: '' });
    load();
  }

  const sumOnPage = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">To'lovlar</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + To'lov qo'shish
        </button>
      </div>

      <div className="filter-bar">
        <div>
          <label className="label">Oy</label>
          <input
            type="month"
            className="input max-w-[180px]"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To'lov usuli</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Barchasi</option>
            <option value="CASH">Naqd</option>
            <option value="CARD">Karta</option>
            <option value="PAYME">Payme</option>
            <option value="CLICK">Click</option>
            <option value="OTHER">Boshqa</option>
          </select>
        </div>
        <span className="text-sm text-slate-500 pb-2">
          Shu sahifada: <strong>{sumOnPage.toLocaleString()} so'm</strong>
        </span>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card mb-6 max-w-md">
          <h2 className="font-semibold mb-4">Yangi to'lov</h2>
          <label className="label">O'quvchi</label>
          <select
            className="input mb-3"
            required
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          >
            <option value="">Tanlang...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
          <label className="label">Summa (so'm)</label>
          <input
            className="input mb-3"
            type="number"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Usul</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="CASH">Naqd</option>
                <option value="CARD">Karta</option>
                <option value="PAYME">Payme</option>
                <option value="CLICK">Click</option>
                <option value="OTHER">Boshqa</option>
              </select>
            </div>
            <div>
              <label className="label">Oy</label>
              <input
                type="month"
                className="input"
                value={form.periodMonth}
                onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
              />
            </div>
          </div>
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
              <th>O'quvchi</th>
              <th>Oy</th>
              <th>Summa</th>
              <th>Usul</th>
              <th>Sana</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const student = findStudent(p.studentId);
              return (
                <tr key={p.id}>
                  <td>
                    {student ? (
                      <Link to={`/students/${student.id}`} className="text-brand-600 hover:underline font-medium">
                        {student.fullName}
                      </Link>
                    ) : (
                      <span className="text-slate-400" title="O'quvchi o'chirilgan bo'lishi mumkin">
                        — (topilmadi)
                      </span>
                    )}
                  </td>
                  <td>{p.periodMonth}</td>
                  <td className="font-medium">{p.amount.toLocaleString()} so'm</td>
                  <td>
                    <span className={METHOD_BADGES[p.method] || 'badge-slate'}>{METHOD_LABELS[p.method] || p.method}</span>
                  </td>
                  <td className="text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {!payments.length && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  To'lovlar topilmadi
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
