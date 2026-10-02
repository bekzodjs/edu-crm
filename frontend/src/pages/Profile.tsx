import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProfileApi, TeacherEarningsApi, TeacherEarningHistoryRow, FeedbackApi, FeedbackSummary, STATIC_URL } from '../api/client';
import { useEffect } from 'react';
import { TrendingUp, ThumbsUp, ThumbsDown, GraduationCap } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { Camera, Trash2, UserCircle } from '../components/icons';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrator',
  RAHBAR: 'Rahbar',
  TEACHER: "O'qituvchi",
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [earnings, setEarnings] = useState<TeacherEarningHistoryRow[] | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  useEffect(() => {
    if (user?.role === 'TEACHER' && user.teacherId) {
      TeacherEarningsApi.history(user.teacherId, 6).then((r) => setEarnings(r.data));
      FeedbackApi.summary(user.teacherId).then((r) => setFeedback(r.data));
    }
  }, [user?.role, user?.teacherId]);

  if (!user) return null;

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await ProfileApi.uploadAvatar(file);
      updateUser({ avatarUrl: (res.data as any).avatarUrl });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onRemoveAvatar() {
    setUploading(true);
    try {
      await ProfileApi.removeAvatar();
      updateUser({ avatarUrl: undefined });
    } finally {
      setUploading(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (newPassword.length < 4) {
      setError("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yangi parollar mos kelmadi');
      return;
    }
    setSaving(true);
    try {
      await ProfileApi.updatePassword(currentPassword, newPassword);
      setSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Mening profilim</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Rasm va ma'lumotlar</h2>
          <div className="flex items-center gap-4 mb-5">
            {user.avatarUrl ? (
              <img
                src={`${STATIC_URL}${user.avatarUrl}`}
                alt=""
                className="w-20 h-20 rounded-full object-cover shrink-0 border border-slate-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <UserCircle size={40} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                className="btn-secondary text-sm"
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} /> {uploading ? 'Yuklanmoqda...' : 'Rasm qo\'yish'}
              </button>
              {user.avatarUrl && (
                <button className="btn-danger text-sm" type="button" disabled={uploading} onClick={onRemoveAvatar}>
                  <Trash2 size={15} /> Rasmni o'chirish
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
            </div>
          </div>

          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Ism</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Telefon</dt>
              <dd>{user.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Rol</dt>
              <dd>{ROLE_LABELS[user.role] || user.role}</dd>
            </div>
          </dl>

          {user.role === 'TEACHER' && user.teacherId && (
            <Link
              to={`/teachers/${user.teacherId}`}
              className="btn-secondary text-sm inline-flex items-center gap-1.5 mt-4"
            >
              <GraduationCap size={15} /> To'liq profilni ko'rish (guruhlarim, hujjatlarim, kelish-ketish tarixi)
            </Link>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Parolni almashtirish</h2>
          <form onSubmit={onChangePassword} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {saved && <p className="text-sm text-green-600 bg-green-100 rounded-lg px-3 py-2">Parol yangilandi.</p>}
            <div>
              <label className="label">Joriy parol</label>
              <input
                className="input"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Yangi parol</label>
              <input
                className="input"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Yangi parolni takrorlang</label>
              <input
                className="input"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saqlanmoqda...' : 'Parolni yangilash'}
            </button>
          </form>
        </div>
      </div>

      {user.role === 'TEACHER' && (
        <div className="card mt-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-600" /> Mening natijalarim (oxirgi 6 oy)
          </h2>
          {!earnings && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
          {earnings && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Oy</th>
                  <th>Guruhlar soni</th>
                  <th>O'quvchilar soni</th>
                  <th>Yig'ilgan to'lovlar</th>
                  <th>Mening ish haqim</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((row) => (
                  <tr key={row.period}>
                    <td>{row.period}</td>
                    <td>{row.groupCount}</td>
                    <td>{row.studentCount}</td>
                    <td>{row.gross.toLocaleString()} so'm</td>
                    <td className="font-medium text-brand-700">{row.earning.toLocaleString()} so'm</td>
                  </tr>
                ))}
                {!earnings.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-6">
                      Ma'lumot yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {user.role === 'TEACHER' && (
        <div className="card mt-6">
          <h2 className="font-semibold mb-4">O'quvchilarning fikr-mulohazalari</h2>
          {!feedback && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
          {feedback && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-5 max-w-sm">
                <div className="rounded-lg bg-green-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-green-700 mb-1">
                    <ThumbsUp size={16} />
                    <span className="text-xl font-semibold">{feedback.positive}</span>
                  </div>
                  <div className="text-xs text-green-700/80">Ijobiy</div>
                </div>
                <div className="rounded-lg bg-red-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-red-700 mb-1">
                    <ThumbsDown size={16} />
                    <span className="text-xl font-semibold">{feedback.negative}</span>
                  </div>
                  <div className="text-xs text-red-700/80">Salbiy</div>
                </div>
              </div>

              <div className="space-y-2">
                {feedback.recent.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                    {f.sentiment === 'POSITIVE' ? (
                      <ThumbsUp size={15} className="text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <ThumbsDown size={15} className="text-red-600 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700">{f.comment || <span className="text-slate-400">(izohsiz)</span>}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{new Date(f.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                {!feedback.recent.length && <p className="text-sm text-slate-400 text-center py-6">Hali fikr-mulohaza yo'q</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
