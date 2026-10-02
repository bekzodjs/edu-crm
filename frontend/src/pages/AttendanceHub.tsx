import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, BookOpen, Star, MapPinned } from '../components/icons';
import Attendance from './Attendance';
import AttendanceReport from './AttendanceReport';
import HomeworkPage from './Homework';
import GradesPage from './Grades';
import TeacherAttendancePage from './TeacherAttendance';
import { useAuth } from '../context/AuthContext';

type TabKey = 'mark' | 'report' | 'homework' | 'grades' | 'teacher';

const TABS: { value: TabKey; label: string; icon: any; roles?: string[] }[] = [
  { value: 'mark', label: 'Davomat', icon: ClipboardCheck },
  { value: 'report', label: 'Hisobot', icon: ClipboardCheck },
  { value: 'homework', label: 'Uyga vazifalar', icon: BookOpen },
  { value: 'grades', label: 'Baholar', icon: Star },
  { value: 'teacher', label: "O'qituvchilar davomati", icon: MapPinned, roles: ['SUPERADMIN', 'ADMIN', 'RAHBAR'] },
];

export default function AttendanceHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const visibleTabs = TABS.filter((t) => !t.roles || (user?.role && t.roles.includes(user.role)));
  const requestedTab = (params.get('tab') as TabKey) || 'mark';
  const tab = visibleTabs.some((t) => t.value === requestedTab) ? requestedTab : 'mark';

  function selectTab(t: TabKey) {
    setParams({ tab: t });
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => selectTab(t.value)}
              className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2 border ${
                tab === t.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'mark' && <Attendance />}
      {tab === 'report' && <AttendanceReport />}
      {tab === 'homework' && <HomeworkPage />}
      {tab === 'grades' && <GradesPage />}
      {tab === 'teacher' && <TeacherAttendancePage />}
    </div>
  );
}
