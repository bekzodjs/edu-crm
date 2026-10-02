import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DebtsApi, Debtor } from '../api/client';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Debts() {
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<{ totalDebt: number; debtorsCount: number; debtors: Debtor[] } | null>(null);

  function load() {
    DebtsApi.get(period).then((r) => setData(r.data));
  }
  useEffect(load, [period]);

  const { page, setPage, pageCount, total, pageItems } = usePagination(data?.debtors || [], 20);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Qarzdorlik</h1>

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
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Qarzdorlar soni</div>
          <div className="text-2xl font-semibold">{data?.debtorsCount ?? '...'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500 mb-1">Jami qarz</div>
          <div className="text-2xl font-semibold text-red-600">{data ? `${data.totalDebt.toLocaleString()} so'm` : '...'}</div>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>O'quvchi</th>
              <th>Kutilgan</th>
              <th>To'langan</th>
              <th>Qarz</th>
              <th>Chegirma</th>
              <th>Ota-ona telefoni</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((d) => (
              <tr key={d.student.id}>
                <td>
                  <Link to={`/students/${d.student.id}`} className="text-brand-600 hover:underline">
                    {d.student.fullName}
                  </Link>
                </td>
                <td>{d.expected.toLocaleString()} so'm</td>
                <td>{d.paid.toLocaleString()} so'm</td>
                <td className="text-red-600 font-medium">{d.debt.toLocaleString()} so'm</td>
                <td>{d.discountPct ? <span className="badge-amber">{d.discountPct}%</span> : '—'}</td>
                <td>{d.student.parentPhone || '—'}</td>
                <td>
                  <Link to={`/students/${d.student.id}`} className="text-sm text-brand-600 hover:underline">
                    Profilga o'tish
                  </Link>
                </td>
              </tr>
            ))}
            {data && !data.debtors.length && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-6">
                  Bu oyda qarzdorlar yo'q 🎉
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
