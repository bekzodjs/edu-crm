import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Filter } from '../components/icons';
import {
  LeaveRequestsApi,
  StudentLeaveRequestsApi,
  LeaveRequest,
  StudentLeaveRequest,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

type Kind = 'TEACHER' | 'PARENT';
type StatusTab = 'PENDING' | 'APPROVED' | 'REJECTED' | '';

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: 'TEACHER', label: "O'qituvchilar" },
  { value: 'PARENT', label: 'Ota-onalar' },
];

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'PENDING', label: 'Kutilmoqda' },
  { value: 'APPROVED', label: 'Tasdiqlangan' },
  { value: 'REJECTED', label: 'Rad etilgan' },
  { value: '', label: 'Barchasi' },
];

function statusBadge(status: string) {
  if (status === 'PENDING') return 'badge-amber';
  if (status === 'APPROVED') return 'badge-green';
  return 'badge-red';
}
function statusLabel(status: string) {
  if (status === 'PENDING') return 'Kutilmoqda';
  if (status === 'APPROVED') return 'Tasdiqlangan';
  return 'Rad etilgan';
}

export default function Arizalar() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  // TEACHER faqat o'zining (o'qituvchi sifatida yuborgan) arizalarini ko'rishi kerak —
  // ota-onalarning arizalari uning uchun emas, shuning uchun "Ota-onalar" tabini
  // butunlay yashiramiz (backend ham TEACHER uchun faqat o'zinikini qaytaradi).
  const visibleKindTabs = isTeacher ? KIND_TABS.filter((t) => t.value === 'TEACHER') : KIND_TABS;
  const [kind, setKind] = useState<Kind>('TEACHER');
  const [statusTab, setStatusTab] = useState<StatusTab>('PENDING');
  const [teacherRequests, setTeacherRequests] = useState<LeaveRequest[]>([]);
  const [parentRequests, setParentRequests] = useState<StudentLeaveRequest[]>([]);
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  function load() {
    if (kind === 'TEACHER') {
      LeaveRequestsApi.list({ status: statusTab || undefined }).then((r) => setTeacherRequests(r.data));
    } else {
      StudentLeaveRequestsApi.list({ status: statusTab || undefined }).then((r) => setParentRequests(r.data));
    }
  }
  useEffect(load, [kind, statusTab]);

  async function onDecide() {
    if (!confirm) return;
    const api = kind === 'TEACHER' ? LeaveRequestsApi : StudentLeaveRequestsApi;
    if (confirm.action === 'approve') await api.approve(confirm.id);
    else await api.reject(confirm.id);
    setConfirm(null);
    load();
  }

  const requests: (LeaveRequest | StudentLeaveRequest)[] = kind === 'TEACHER' ? teacherRequests : parentRequests;
  const { page, setPage, pageCount, total, pageItems } = usePagination(requests, 10);

  const kindLabel = KIND_TABS.find((t) => t.value === kind)?.label;
  const statusLabelForTab = STATUS_TABS.find((t) => t.value === statusTab)?.label;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-5">Arizalar</h1>

      <div className="relative inline-block mb-5">
        <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setFilterOpen((v) => !v)}>
          <Filter size={14} />
          {isTeacher ? (
            <>Filtr: <span className="font-semibold">{statusLabelForTab}</span></>
          ) : (
            <>Filtr: <span className="font-semibold">{kindLabel}</span> · <span className="font-semibold">{statusLabelForTab}</span></>
          )}
        </button>

        {filterOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
            <div className="absolute z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-4">
              {visibleKindTabs.length > 1 && (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kimning arizasi</div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {visibleKindTabs.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setKind(t.value)}
                        className={`text-sm font-medium rounded-lg px-3 py-1.5 border ${
                          kind === t.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Holati</div>
              <div className="flex gap-2 flex-wrap">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setStatusTab(t.value)}
                    className={`text-sm rounded-full px-3 py-1.5 border ${
                      statusTab === t.value ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {kind === 'TEACHER' &&
            (pageItems as LeaveRequest[]).map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.teacher?.fullName || "Noma'lum o'qituvchi"}</span>
                    <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5 truncate">{r.reason}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.decidedNote && ` · Izoh: ${r.decidedNote}`}
                  </div>
                </div>
                {r.status === 'PENDING' && !isTeacher && (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setConfirm({ id: r.id, action: 'approve' })}>
                      <Check size={13} /> Tasdiqlash
                    </button>
                    <button className="btn-danger !px-2.5 !py-1.5 text-xs" onClick={() => setConfirm({ id: r.id, action: 'reject' })}>
                      <X size={13} /> Rad etish
                    </button>
                  </div>
                )}
              </div>
            ))}

          {kind === 'PARENT' &&
            (pageItems as StudentLeaveRequest[]).map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.student ? (
                      <Link to={`/students/${r.student.id}`} className="font-medium text-sm text-brand-600 hover:underline">
                        {r.student.fullName}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm">Noma'lum o'quvchi</span>
                    )}
                    <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5 truncate">{r.reason}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.decidedNote && ` · Izoh: ${r.decidedNote}`}
                  </div>
                </div>
                {r.status === 'PENDING' && !isTeacher && (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setConfirm({ id: r.id, action: 'approve' })}>
                      <Check size={13} /> Tasdiqlash
                    </button>
                    <button className="btn-danger !px-2.5 !py-1.5 text-xs" onClick={() => setConfirm({ id: r.id, action: 'reject' })}>
                      <X size={13} /> Rad etish
                    </button>
                  </div>
                )}
              </div>
            ))}

          {!requests.length && <div className="text-sm text-slate-400 text-center py-10">Arizalar yo'q</div>}
        </div>
        <div className="px-4 pb-4">
          <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.action === 'approve' ? 'Arizani tasdiqlaysizmi?' : 'Arizani rad etasizmi?'}
        description={
          kind === 'TEACHER'
            ? "O'qituvchiga Telegram orqali qaror haqida avtomatik xabar yuboriladi."
            : 'Ota-onaga Telegram orqali qaror haqida avtomatik xabar yuboriladi.'
        }
        danger={confirm?.action === 'reject'}
        confirmLabel={confirm?.action === 'approve' ? 'Tasdiqlash' : 'Rad etish'}
        onConfirm={onDecide}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
