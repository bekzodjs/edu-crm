import { useEffect, useState } from 'react';
import { GroupsApi, HomeworkApi, Group, Homework } from '../api/client';
import { Upload, Trash2, BookOpen } from '../components/icons';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import ConfirmDialog from '../components/ConfirmDialog';

export default function HomeworkPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { page, setPage, pageCount, total, pageItems } = usePagination(items, 10);

  useEffect(() => {
    GroupsApi.list().then((r) => {
      setGroups(r.data);
      if (r.data.length) setGroupId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!groupId) {
      setItems([]);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  function load() {
    setLoading(true);
    HomeworkApi.list(groupId)
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }

  const selectedGroup = groups.find((g) => g.id === groupId);

  function resetForm() {
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setDueDate('');
    setFile(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !title.trim() || !selectedGroup) return;
    setSaving(true);
    try {
      await HomeworkApi.create({
        groupId,
        teacherId: selectedGroup.teacherId,
        title: title.trim(),
        description: description.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        dueDate: dueDate || undefined,
        file: file || undefined,
      });
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!removeId) return;
    await HomeworkApi.remove(removeId);
    setRemoveId(null);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Uyga vazifalar</h1>

      <div className="card mb-6 max-w-md">
        <label className="label">Guruhni tanlang</label>
        <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {!groups.length && <option value="">Guruhlar yo'q</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {groupId && (
        <>
          <div className="card mb-6">
            <h2 className="font-semibold mb-4">Yangi vazifa qo'shish</h2>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Sarlavha</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Masalan: 5-bob mashqlari" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Tavsif</label>
                <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vazifa haqida qo'shimcha izoh" />
              </div>
              <div>
                <label className="label">Video havola (YouTube va h.k.)</label>
                <input className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Muddat</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Yoki fayl biriktirish (PDF, rasm va h.k.)</label>
                <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="sm:col-span-2">
                <button className="btn-primary" disabled={saving} type="submit">
                  <Upload size={16} className="mr-1.5 inline" />
                  {saving ? 'Saqlanmoqda...' : "Vazifani e'lon qilish"}
                </button>
              </div>
            </form>
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold">Berilgan vazifalar</div>
            {loading ? (
              <div className="text-center text-slate-400 py-8">Yuklanmoqda...</div>
            ) : !items.length ? (
              <div className="text-center text-slate-400 py-8">Hali vazifa berilmagan</div>
            ) : (
              <>
              <ul className="divide-y divide-slate-100">
                {pageItems.map((h) => (
                  <li key={h.id} className="px-5 py-4 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 text-brand-600">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <div className="font-medium">{h.title}</div>
                        {h.description && <div className="text-sm text-slate-500 mt-0.5">{h.description}</div>}
                        <div className="text-xs text-slate-400 mt-1 flex gap-3 flex-wrap">
                          <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                          {h.dueDate && <span>Muddat: {new Date(h.dueDate).toLocaleDateString()}</span>}
                          {h.videoUrl && (
                            <a href={h.videoUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                              Video havola
                            </a>
                          )}
                          {h.fileUrl && (
                            <a href={h.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                              {h.fileName || 'Fayl'}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button className="btn-ghost !px-2 !py-2 text-red-500" onClick={() => setRemoveId(h.id)} title="O'chirish">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3">
                <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
              </div>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!removeId}
        title="Vazifani o'chirish"
        description="Bu vazifa butunlay o'chiriladi. Davom etasizmi?"
        confirmLabel="Ha, o'chirish"
        cancelLabel="Yo'q"
        danger
        onConfirm={onRemove}
        onCancel={() => setRemoveId(null)}
      />
    </div>
  );
}
