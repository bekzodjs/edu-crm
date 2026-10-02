import { ChevronLeft, ChevronRight } from './icons';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pageCount, total, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-slate-400">Jami: {total} ta</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost !px-2 !py-1.5" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-slate-600 px-2">
          {page} / {pageCount}
        </span>
        <button className="btn-ghost !px-2 !py-1.5" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
