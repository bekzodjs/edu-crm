import { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

function base(paths: React.ReactNode) {
  return function Icon({ size = 18, strokeWidth = 2, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const LayoutDashboard = base(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>,
);

export const Users = base(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M15.5 14.2c2.7.3 5 2.5 5 5.8" />
  </>,
);

export const Layers = base(
  <>
    <path d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
    <path d="M2.5 13 12 18l9.5-5" />
    <path d="M2.5 17.5 12 22.5l9.5-5" />
  </>,
);

export const GraduationCap = base(
  <>
    <path d="M2 8.5 12 4l10 4.5-10 4.5-10-4.5Z" />
    <path d="M6 11v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" />
    <path d="M21 8.5V14" />
  </>,
);

export const CalendarDays = base(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18" />
    <path d="M8 2.5v4M16 2.5v4" />
    <path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01M16.5 17h.01" />
  </>,
);

export const ClipboardCheck = base(
  <>
    <rect x="5.5" y="4" width="13" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="m9 13 2 2 4-4.5" />
  </>,
);

export const Wallet = base(
  <>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5" />
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <circle cx="16.5" cy="14" r="1.4" />
  </>,
);

export const AlertCircle = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v6" />
    <path d="M12 16.5h.01" />
  </>,
);

export const AlertTriangle = base(
  <>
    <path d="M10.6 3.9 2.7 18a1.5 1.5 0 0 0 1.3 2.3h16a1.5 1.5 0 0 0 1.3-2.3L13.4 3.9a1.5 1.5 0 0 0-2.8 0Z" />
    <path d="M12 9.5V13.5" />
    <path d="M12 17h.01" />
  </>,
);

export const MapPinned = base(
  <>
    <path d="M18 8.5c0 5-6 12-6 12s-6-7-6-12a6 6 0 0 1 12 0Z" />
    <circle cx="12" cy="8.5" r="2.2" />
  </>,
);

export const MapPin = MapPinned;

export const FileText = base(
  <>
    <path d="M6 2.5h8l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5Z" />
    <path d="M14 2.5V7h4.5" />
    <path d="M8 12.5h8M8 16h8M8 9h3" />
  </>,
);

export const LogOut = base(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

export const ChevronsLeft = base(
  <>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </>,
);

export const ChevronsRight = base(
  <>
    <path d="m13 17 5-5-5-5" />
    <path d="m6 17 5-5-5-5" />
  </>,
);

export const ChevronLeft = base(<path d="m14.5 18-6-6 6-6" />);
export const ChevronRight = base(<path d="m9.5 18 6-6-6-6" />);

export const Phone = base(
  <path d="M4.5 4h3.2l1.3 4.5-2 1.5a13 13 0 0 0 5.5 5.5l1.5-2 4.5 1.3v3.2a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3 5.6 1.5 1.5 0 0 1 4.5 4Z" />,
);

export const Lock = base(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </>,
);

export const Eye = base(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const EyeOff = base(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.4 4.2M6.3 6.4A15 15 0 0 0 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6" />
    <path d="M9.5 9.8a3 3 0 0 0 4.2 4.2" />
  </>,
);

export const Loader2 = base(<path d="M12 3a9 9 0 1 0 9 9" />);

export const Search = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const Send = base(<path d="M4 11 20.5 3 15 20l-4.5-6.5L4 11Z" />);

export const Filter = base(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);

export const X = base(
  <>
    <path d="M5 5l14 14" />
    <path d="M19 5 5 19" />
  </>,
);

export const Check = base(<path d="m4.5 12.5 5 5 10-11" />);

export const RefreshCw = base(
  <>
    <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6M20.5 12a8.5 8.5 0 0 1-14.5 6" />
    <path d="M18 3v3.5h-3.5" />
    <path d="M6 21v-3.5h3.5" />
  </>,
);
export const Upload = base(
  <>
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </>,
);
export const Download = base(
  <>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 21h16" />
  </>,
);
export const Trash2 = base(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);
export const BookOpen = base(
  <>
    <path d="M2 5.5c2-1 5-1.5 7-1.5 2.3 0 4.7.6 5.5 1.5v13c-.8-.9-3.2-1.5-5.5-1.5-2 0-5 .5-7 1.5v-13Z" />
    <path d="M22 5.5c-2-1-5-1.5-7-1.5-2.3 0-4.7.6-5.5 1.5v13c.8-.9 3.2-1.5 5.5-1.5 2 0 5 .5 7 1.5v-13Z" />
  </>,
);
export const Star = base(
  <path d="m12 3 2.7 5.9 6.3.6-4.7 4.3 1.3 6.3L12 17l-5.6 3.1 1.3-6.3-4.7-4.3 6.3-.6L12 3Z" />,
);
export const Award = base(
  <>
    <circle cx="12" cy="8" r="5.5" />
    <path d="m8.5 13-1.5 8 5-2.5 5 2.5-1.5-8" />
  </>,
);
export const Shield = base(
  <path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z" />,
);
export const Percent = base(
  <>
    <path d="M5 19 19 5" />
    <circle cx="6.5" cy="6.5" r="2" />
    <circle cx="17.5" cy="17.5" r="2" />
  </>,
);
export const Plus = base(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);
export const Sun = base(
  <>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
  </>,
);
export const Moon = base(
  <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />,
);
export const Settings = base(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.4.6a7.7 7.7 0 0 0-1.7-1L14.8 3h-4l-.5 2.6a7.7 7.7 0 0 0-1.7 1l-2.4-.6-2 3.5L6.2 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-.6a7.7 7.7 0 0 0 1.7 1l.5 2.6h4l.5-2.6a7.7 7.7 0 0 0 1.7-1l2.4.6 2-3.5-2-1.5Z" />
  </>,
);
export const Camera = base(
  <>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </>,
);
export const TrendingUp = base(
  <>
    <path d="M3 17 9.5 10.5 14 15l7-8" />
    <path d="M16 7h5v5" />
  </>,
);
export const ThumbsUp = base(
  <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4.5-7a2 2 0 0 1 3.7 1.2L14.5 9H19a2 2 0 0 1 1.9 2.7l-2.4 7A2 2 0 0 1 16.6 20H9a2 2 0 0 1-2-2v-7Z" />,
);
export const ThumbsDown = base(
  <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4.5 7a2 2 0 0 1-3.7-1.2L9.5 15H5a2 2 0 0 1-1.9-2.7l2.4-7A2 2 0 0 1 7.4 4H15a2 2 0 0 1 2 2v7Z" />,
);
export const UserCircle = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6 19.2a6.5 6.5 0 0 1 12 0" />
  </>,
);
