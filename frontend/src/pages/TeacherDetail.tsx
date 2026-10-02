import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TeachersApi,
  TelegramApi,
  TeacherAttendanceApi,
  LeaveRequestsApi,
  Teacher,
  TeacherAttendanceRecord,
  LeaveRequest,
  STATIC_URL,
} from '../api/client';
import { MapPin, Phone, Send, GraduationCap, FileText, Upload, Trash2, Loader2 } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
function fileSizeLabel(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  DIPLOM: 'Diplom',
  SERTIFIKAT: 'Sertifikat',
  MALAKA_KURSI: 'Malaka kursi',
  BOSHQA: 'Boshqa',
};
const DOC_TYPE_BADGES: Record<string, string> = {
  DIPLOM: 'badge-brand',
  SERTIFIKAT: 'badge-green',
  MALAKA_KURSI: 'badge-amber',
  BOSHQA: 'badge-slate',
};

export default function TeacherDetail() {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const { id } = useParams<{ id: string }>();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [history, setHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<boolean | null>(null);

  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('DIPLOM');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const historyPage = usePagination(history, 10);
  const leavesPage = usePagination(leaves, 10);

  function load() {
    if (!id) return;
    TeachersApi.get(id).then((r) => setTeacher(r.data));
    TeacherAttendanceApi.list({ teacherId: id }).then((r) => setHistory(r.data));
    LeaveRequestsApi.list({ teacherId: id }).then((r) => setLeaves(r.data));
  }
  useEffect(load, [id]);
  useEffect(() => {
    TelegramApi.status().then((r) => setBotStatus(r.data.enabled));
  }, []);

  async function onGenerateLink() {
    if (!id) return;
    const res = await TelegramApi.createTeacherLink(id);
    setLinkCode((res.data as any).linkCode);
  }

  async function onUploadDocument(e: FormEvent) {
    e.preventDefault();
    if (!id || !docFile || !docTitle.trim()) return;
    setUploading(true);
    try {
      await TeachersApi.addDocument(id, docTitle.trim(), docType, docFile);
      setDocTitle('');
      setDocType('DIPLOM');
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveDocument(docId: string) {
    if (!id) return;
    if (!confirm("Bu hujjatni o'chirishni tasdiqlaysizmi?")) return;
    await TeachersApi.removeDocument(id, docId);
    load();
  }

  if (!teacher) return <p className="text-slate-400">Yuklanmoqda...</p>;

  const groups = teacher.groups || [];
  const documents = teacher.documents || [];
  const isCheckedIn = history[0]?.type === 'CHECK_IN';

  return (
    <div>
      <Link to="/teachers" className="text-sm text-brand-600 hover:underline">
        ← O'qituvchilarga qaytish
      </Link>

      <div className="flex items-center gap-4 mt-2 mb-6">
        <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-semibold shrink-0">
          {initials(teacher.fullName)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{teacher.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={teacher.active ? 'badge-green' : 'badge-slate'}>
              {teacher.active ? 'Faol' : 'Nofaol'}
            </span>
            {teacher.subject && <span className="badge-brand">{teacher.subject}</span>}
            {history.length > 0 && (
              <span className={isCheckedIn ? 'badge-green' : 'badge-slate'}>
                {isCheckedIn ? 'Hozir ishda' : 'Ishda emas'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Ma'lumotlar</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Telefon</dt>
              <dd className="inline-flex items-center gap-1">
                <Phone size={14} /> {teacher.phone}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Fan/yo'nalish</dt>
              <dd>{teacher.subject || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Standart maosh foizi</dt>
              <dd>{teacher.salaryPct != null ? `${teacher.salaryPct}%` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Guruhlar</dt>
              <dd className="text-right">{groups.length ? groups.map((g) => g.name).join(', ') : '—'}</dd>
            </div>
          </dl>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <h3 className="font-semibold text-sm mb-2">Telegram bog'lanishi</h3>
            {botStatus === false && (
              <p className="text-xs text-amber-600 mb-2">
                Bot hozircha o'chirilgan (.env faylida TELEGRAM_BOT_TOKEN kiritilmagan).
              </p>
            )}
            <button className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={onGenerateLink}>
              <Send size={14} /> Bog'lash kodi yaratish
            </button>
            {linkCode && (
              <p className="text-sm mt-3 bg-slate-50 rounded-lg p-3">
                O'qituvchiga shu buyruqni Telegram botga yuborishni ayting:
                <br />
                <code className="text-brand-700 font-mono">/start {linkCode}</code>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-3">
              Bog'langandan so'ng u <code>/keldim</code>, <code>/ketyapman</code> va{' '}
              <code>/ariza &lt;sabab&gt;</code> buyruqlaridan foydalanishi mumkin.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <GraduationCap size={18} /> Biriktirilgan guruhlar
          </h2>
          {!groups.length && <p className="text-sm text-slate-400">Guruhlar biriktirilmagan</p>}
          <div className="space-y-2">
            {groups.map((g) => {
              const pct = g.salaryPct ?? teacher.salaryPct;
              return (
                <Link
                  to="/groups"
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {g.name}
                      {pct != null && (
                        <span
                          className={g.salaryPct != null ? 'badge-brand' : 'badge-slate'}
                          title={g.salaryPct != null ? "Shu guruhga xos maosh foizi" : "O'qituvchining standart foizi"}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>
                    {g.room && <div className="text-xs text-slate-400">{g.room} xona</div>}
                  </div>
                  <div className="text-right">
                    <div>{g.price?.toLocaleString()} so'm</div>
                    <div className="text-xs text-slate-400">{g.studentIds?.length || 0} o'quvchi</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText size={18} /> Hujjatlar (diplom, sertifikat, malaka kurslari)
        </h2>

        {canManage && (
        <form onSubmit={onUploadDocument} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end mb-5">
          <div>
            <label className="label">Hujjat nomi</label>
            <input
              className="input"
              placeholder="Masalan: Oliy ma'lumot diplomi"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Turi</label>
            <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="DIPLOM">Diplom</option>
              <option value="SERTIFIKAT">Sertifikat</option>
              <option value="MALAKA_KURSI">Malaka kursi</option>
              <option value="BOSHQA">Boshqa</option>
            </select>
          </div>
          <div>
            <label className="label">Fayl</label>
            <input
              ref={fileInputRef}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700 file:px-3 file:py-1.5 file:text-sm"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <button className="btn-primary whitespace-nowrap" type="submit" disabled={uploading || !docFile}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Yuklanmoqda...' : 'Yuklash'}
          </button>
        </form>
        )}

        {!documents.length && <p className="text-sm text-slate-400">Hozircha hujjatlar yuklanmagan</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className={DOC_TYPE_BADGES[d.type] || 'badge-slate'}>{DOC_TYPE_LABELS[d.type] || d.type}</span>
                {canManage && (
                  <button
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    onClick={() => onRemoveDocument(d.id)}
                    title="O'chirish"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="font-medium text-sm mt-2">{d.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {new Date(d.uploadedAt).toLocaleDateString()} {fileSizeLabel(d.fileSize) && `· ${fileSizeLabel(d.fileSize)}`}
              </div>
              <a
                href={`${STATIC_URL}${d.fileUrl}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs mt-3 !py-1.5 inline-flex items-center gap-1.5"
              >
                <FileText size={13} /> Ko'rish / yuklab olish
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Kelish/ketish tarixi</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Turi</th>
              <th>Vaqt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historyPage.pageItems.map((h) => (
              <tr key={h.id}>
                <td>
                  <span className={h.type === 'CHECK_IN' ? 'badge-green' : 'badge-red'}>
                    {h.type === 'CHECK_IN' ? 'Keldi' : 'Ketdi'}
                  </span>
                </td>
                <td>{new Date(h.capturedAt).toLocaleString()}</td>
                <td>
                  <a
                    href={mapsLink(h.latitude, h.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline text-sm inline-flex items-center gap-1"
                  >
                    <MapPin size={14} /> Xaritada
                  </a>
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td colSpan={3} className="text-slate-400 py-3">
                  Davomat ma'lumoti yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pt-2">
          <Pagination page={historyPage.page} pageCount={historyPage.pageCount} total={historyPage.total} onChange={historyPage.setPage} />
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Arizalar</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sabab</th>
              <th>Holat</th>
              <th>Sana</th>
            </tr>
          </thead>
          <tbody>
            {leavesPage.pageItems.map((l) => (
              <tr key={l.id}>
                <td>{l.reason}</td>
                <td>
                  {l.status === 'PENDING' && <span className="badge-amber">Kutilmoqda</span>}
                  {l.status === 'APPROVED' && <span className="badge-green">Tasdiqlandi</span>}
                  {l.status === 'REJECTED' && <span className="badge-red">Rad etildi</span>}
                </td>
                <td className="text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!leaves.length && (
              <tr>
                <td colSpan={3} className="text-slate-400 py-3">
                  Arizalar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pt-2">
          <Pagination page={leavesPage.page} pageCount={leavesPage.pageCount} total={leavesPage.total} onChange={leavesPage.setPage} />
        </div>
      </div>
    </div>
  );
}
