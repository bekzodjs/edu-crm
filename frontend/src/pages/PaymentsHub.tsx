import { Link, useSearchParams } from 'react-router-dom';
import { Wallet, AlertCircle, TrendingUp } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import Payments from './Payments';
import Debts from './Debts';
import TeacherEarnings from './TeacherEarnings';

type TabKey = 'payments' | 'debts' | 'earnings';

const TABS: { value: TabKey; label: string; icon: any; roles?: string[] }[] = [
  { value: 'payments', label: "To'lovlar", icon: Wallet },
  { value: 'debts', label: 'Qarzdorlik', icon: AlertCircle },
  { value: 'earnings', label: "O'qituvchilar daromadi", icon: TrendingUp, roles: ['SUPERADMIN', 'ADMIN'] },
];

export default function PaymentsHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) || 'payments';
  const visibleTabs = TABS.filter((t) => !t.roles || (user?.role && t.roles.includes(user.role)));

  function selectTab(t: TabKey) {
    setParams({ tab: t });
  }

  if (user?.role === 'TEACHER') {
    return (
      <div className="card max-w-md">
        <h2 className="font-semibold mb-2">Bu bo'lim mavjud emas</h2>
        <p className="text-sm text-slate-500 mb-4">
          To'lovlar va daromad hisobotlari faqat administratsiya uchun. O'zingizning ish haqingizni "Mening
          profilim" sahifasidan ko'rishingiz mumkin.
        </p>
        <Link to="/profile" className="btn-primary inline-flex">
          Mening profilim
        </Link>
      </div>
    );
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

      {tab === 'payments' && <Payments />}
      {tab === 'debts' && <Debts />}
      {tab === 'earnings' && visibleTabs.some((t) => t.value === 'earnings') && <TeacherEarnings />}
    </div>
  );
}
