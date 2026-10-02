import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeacherEarningsApi, TeacherEarningRow } from '../api/client';
import { Wallet } from '../components/icons';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TeacherEarnings() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<TeacherEarningRow[]>([]);
  const [totalEarning, setTotalEarning] = useState(0);
  const [loading, setLoading] = useState(false);
  const { page, setPage, pageCount, total, pageItems } = usePagination(rows, 15);

  function load() {
    setLoading(true);
    TeacherEarningsApi.forPeriod(period)
      .then((r) => {
        setRows(r.data.rows);
        setTotalEarning(r.data.totalEarning);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, [period]);

  return (
    <div>
      <div className="filter-bar">
        <div>
          <label className="label">Oy</label>
          <input type="month" className="input max-w-[180px]" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>

      <div className="card mb-6 max-w-xs">
        <div className="text-sm text-slate-500 mb-1">Jami ish haqi (shu oy)</div>
        <div className="text-2xl font-semibold text-brand-700">{totalEarning.toLocaleString()} so'm</div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center gap-2">
          <Wallet size={18} />
          O'qituvchilar bo'yicha daromad
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>O'qituvchi</th>
              <th>Guruhlar</th>
              <th>O'quvchilar</th>
              <th>Yig'ilgan to'lovlar</th>
              <th>Ish haqi % (o'rtacha)</th>
              <th>Ish haqi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Yuklanmoqda...
                </td>
              </tr>
            )}
            {!loading &&
              pageItems.map((r) => (
                <tr key={r.teacherId}>
                  <td>
                    <Link to={`/teachers/${r.teacherId}`} className="text-brand-600 hover:underline font-medium">
                      {r.fullName}
                    </Link>
                  </td>
                  <td>{r.groupCount}</td>
                  <td>{r.studentCount}</td>
                  <td>{r.gross.toLocaleString()} so'm</td>
                  <td>
                    {r.salaryPct}%
                    {r.mixedPct && (
                      <span className="text-xs text-slate-400 ml-1" title="Guruhlar turli foizda — bu o'rtacha (effektiv) qiymat">
                        (aralash)
                      </span>
                    )}
                  </td>
                  <td className="font-semibold text-brand-700">{r.earning.toLocaleString()} so'm</td>
                </tr>
              ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Ma'lumot yo'q
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
