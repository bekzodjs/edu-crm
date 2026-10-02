import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Layers, GraduationCap, AlertCircle, MapPinned, FileText } from '../components/icons';
import {
  StudentsApi,
  GroupsApi,
  TeachersApi,
  DebtsApi,
  TeacherAttendanceApi,
  LeaveRequestsApi,
  Group,
  Teacher,
  Debtor,
} from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  // TEACHER uchun "O'qituvchilar" (boshqalar ro'yxati) va "Qarzdorlik" (moliyaviy
  // hisobot) kartochkalari tegishli emas — bu ma'lumotlar unga backendda ham yopiq.
  const isTeacher = user?.role === 'TEACHER';
  const [activeStudents, setActiveStudents] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [debts, setDebts] = useState<{ totalDebt: number; debtorsCount: number; debtors: Debtor[] } | null>(null);
  const [activeTeachersNow, setActiveTeachersNow] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);

  useEffect(() => {
    StudentsApi.list({ onlyActive: 'true', limit: 1 }).then((r) => setActiveStudents(r.data.total));
    GroupsApi.list().then((r) => setGroups(r.data));
    if (!isTeacher) {
      TeachersApi.list().then((r) => setTeachers(r.data));
      DebtsApi.get().then((r) => setDebts(r.data));
      TeacherAttendanceApi.live().then((r) => setActiveTeachersNow(r.data.filter((l) => l.active).length));
    }
    LeaveRequestsApi.list({ status: 'PENDING' }).then((r) => setPendingLeaves(r.data.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const cards = [
    { label: isTeacher ? "O'quvchilarim" : "Faol o'quvchilar", value: activeStudents, to: '/students', icon: Users },
    { label: isTeacher ? 'Guruhlarim' : 'Guruhlar', value: groups.length, to: '/groups', icon: Layers },
    ...(isTeacher
      ? []
      : [
          { label: "O'qituvchilar", value: teachers.length, to: '/teachers', icon: GraduationCap },
          {
            label: 'Joriy oy qarzdorligi',
            value: debts ? `${debts.totalDebt.toLocaleString()} so'm` : '...',
            to: '/payments?tab=debts',
            danger: (debts?.totalDebt ?? 0) > 0,
            icon: AlertCircle,
          },
        ]),
    { label: 'Hozir ishda', value: activeTeachersNow, to: '/attendance?tab=teacher', icon: MapPinned },
    {
      label: isTeacher ? 'Mening arizalarim (kutilmoqda)' : 'Kutilayotgan arizalar',
      value: pendingLeaves,
      to: '/arizalar',
      danger: pendingLeaves > 0,
      icon: FileText,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Bosh sahifa</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="card card-hover flex items-start gap-4">
              <div className={`rounded-xl p-2.5 ${c.danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
                <Icon size={20} />
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">{c.label}</div>
                <div className={`text-2xl font-semibold ${c.danger ? 'text-red-600' : 'text-slate-800'}`}>{c.value}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {!isTeacher && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Eng yirik qarzdorlar</h2>
            <Link to="/payments?tab=debts" className="text-sm text-brand-600 hover:underline">
              Barchasini ko'rish
            </Link>
          </div>
          {!debts?.debtors.length && <p className="text-sm text-slate-400">Qarzdorlar yo'q 🎉</p>}
          <table className="data-table">
            <tbody>
              {debts?.debtors.slice(0, 5).map((d) => (
                <tr key={d.student.id}>
                  <td>{d.student.fullName}</td>
                  <td className="text-red-600 font-medium">{d.debt.toLocaleString()} so'm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
