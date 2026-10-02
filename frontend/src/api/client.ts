import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const STATIC_URL = API_URL.replace(/\/api\/?$/, '');

export const http = axios.create({ baseURL: API_URL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface TeacherDocument {
  id: string;
  title: string;
  type: 'DIPLOM' | 'SERTIFIKAT' | 'MALAKA_KURSI' | 'BOSHQA';
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  phone: string;
  subject?: string;
  salaryPct?: number;
  active: boolean;
  groups?: Group[];
  documents?: TeacherDocument[];
}

export interface Group {
  id: string;
  name: string;
  subject?: string;
  price: number;
  capacity: number;
  teacherId: string;
  teacher?: Teacher;
  room?: string;
  active: boolean;
  studentIds: string[];
  students?: Student[];
  scheduleSlots?: ScheduleSlot[];
  salaryPct?: number;
}

export interface Student {
  id: string;
  fullName: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  active: boolean;
  groupIds: string[];
  groups?: Group[];
  payments?: Payment[];
  attendances?: Attendance[];
  createdAt?: string;
  discountPct?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface ScheduleSlot {
  id: string;
  groupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
}

export interface Lesson {
  id: string;
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
  group?: Group;
  students?: Student[];
  attendances?: Attendance[];
}

export interface Attendance {
  id: string;
  lessonId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string;
  markedAt: string;
  lateMinutes?: number;
}

export interface AttendanceReportRow {
  studentId: string;
  fullName: string;
  parentPhone?: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  lateMinutesTotal: number;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  periodMonth: string;
  note?: string;
  createdAt: string;
}

export interface Debtor {
  student: { id: string; fullName: string; parentPhone?: string };
  period: string;
  expected: number;
  paid: number;
  debt: number;
  discountPct?: number;
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  teacher: Teacher | null;
  type: 'CHECK_IN' | 'CHECK_OUT';
  latitude: number;
  longitude: number;
  capturedAt: string;
}

export interface TeacherLiveLocation {
  id: string;
  teacherId: string;
  teacher: Teacher | null;
  latitude: number;
  longitude: number;
  active: boolean;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacher: Teacher | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt?: string;
  decidedNote?: string;
}

export interface StudentLeaveRequest {
  id: string;
  studentId: string;
  student: Student | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt?: string;
  decidedNote?: string;
}

export type AppRole = 'SUPERADMIN' | 'ADMIN' | 'RAHBAR' | 'TEACHER';

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  teacherId?: string;
  avatarUrl?: string;
  plainPassword?: string;
}

export interface Homework {
  id: string;
  groupId: string;
  teacherId: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  videoUrl?: string;
  dueDate?: string;
  createdAt: string;
}

export interface Grade {
  id: string;
  studentId: string;
  groupId: string;
  teacherId: string;
  lessonId?: string;
  score: number;
  comment?: string;
  createdAt: string;
}

export interface GradeSummary {
  recent: Grade[];
  week: { count: number; average: number };
  month: { count: number; average: number };
}

export const AuthApi = {
  login: (phone: string, password: string) => http.post('/auth/login', { phone, password }),
};

export const StudentsApi = {
  list: (params?: { search?: string; groupId?: string; onlyActive?: string; page?: number; limit?: number }) =>
    http.get<Paginated<Student>>('/students', { params }),
  get: (id: string) => http.get<Student>(`/students/${id}`),
  create: (data: Partial<Student>) => http.post<Student>('/students', data),
  update: (id: string, data: Partial<Student>) => http.patch<Student>(`/students/${id}`, data),
  remove: (id: string) => http.delete(`/students/${id}`),
};

export const TeachersApi = {
  list: () => http.get<Teacher[]>('/teachers'),
  get: (id: string) => http.get<Teacher>(`/teachers/${id}`),
  create: (data: Partial<Teacher>) => http.post<Teacher>('/teachers', data),
  update: (id: string, data: Partial<Teacher>) => http.patch<Teacher>(`/teachers/${id}`, data),
  remove: (id: string) => http.delete(`/teachers/${id}`),
  addDocument: (id: string, title: string, type: string, file: File) => {
    const form = new FormData();
    form.append('title', title);
    form.append('type', type);
    form.append('file', file);
    return http.post<Teacher>(`/teachers/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeDocument: (id: string, docId: string) => http.delete<Teacher>(`/teachers/${id}/documents/${docId}`),
};

export const GroupsApi = {
  list: () => http.get<Group[]>('/groups'),
  get: (id: string) => http.get<Group>(`/groups/${id}`),
  create: (data: Partial<Group>) => http.post<Group>('/groups', data),
  update: (id: string, data: Partial<Group>) => http.patch<Group>(`/groups/${id}`, data),
  remove: (id: string) => http.delete(`/groups/${id}`),
};

export const ScheduleApi = {
  slots: (groupId?: string) => http.get<ScheduleSlot[]>('/schedule/slots', { params: { groupId } }),
  createSlot: (data: Partial<ScheduleSlot>) => http.post<ScheduleSlot>('/schedule/slots', data),
  removeSlot: (id: string) => http.delete(`/schedule/slots/${id}`),
  generateLessons: (data: { groupId?: string; fromDate: string; toDate: string }) =>
    http.post('/schedule/lessons/generate', data),
  lessons: (params?: { groupId?: string; from?: string; to?: string }) =>
    http.get<Lesson[]>('/schedule/lessons', { params }),
  lesson: (id: string) => http.get<Lesson>(`/schedule/lessons/${id}`),
};

export const AttendanceApi = {
  markBulk: (data: { lessonId: string; entries: { studentId: string; status: string; note?: string; lateMinutes?: number }[] }) =>
    http.post('/attendance', data),
  byLesson: (lessonId: string) => http.get<Attendance[]>(`/attendance/lesson/${lessonId}`),
  byStudent: (studentId: string) => http.get<Attendance[]>(`/attendance/student/${studentId}`),
  report: (params?: { from?: string; to?: string; groupId?: string }) =>
    http.get<AttendanceReportRow[]>('/attendance/report', { params }),
};

export const PaymentsApi = {
  list: (params?: { studentId?: string; periodMonth?: string; method?: string; page?: number; limit?: number }) =>
    http.get<Paginated<Payment>>('/payments', { params }),
  create: (data: Partial<Payment>) => http.post<Payment>('/payments', data),
};

export const DebtsApi = {
  get: (period?: string) =>
    http.get<{ period: string; totalDebt: number; debtorsCount: number; debtors: Debtor[] }>('/debts', {
      params: { period },
    }),
};

export const TelegramApi = {
  createLink: (studentId: string) => http.post(`/telegram/link/${studentId}`),
  getLinks: (studentId: string) => http.get(`/telegram/link/${studentId}`),
  createTeacherLink: (teacherId: string) => http.post(`/telegram/teacher-link/${teacherId}`),
  getTeacherLinks: (teacherId: string) => http.get(`/telegram/teacher-link/${teacherId}`),
  status: () => http.get<{ enabled: boolean }>('/telegram/status'),
};

export const TeacherAttendanceApi = {
  list: (params?: { teacherId?: string; from?: string; to?: string }) =>
    http.get<TeacherAttendanceRecord[]>('/teacher-attendance', { params }),
  live: () => http.get<TeacherLiveLocation[]>('/teacher-attendance/live'),
};

export const LeaveRequestsApi = {
  list: (params?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; teacherId?: string }) =>
    http.get<LeaveRequest[]>('/leave-requests', { params }),
  approve: (id: string, note?: string) => http.patch(`/leave-requests/${id}/approve`, { note }),
  reject: (id: string, note?: string) => http.patch(`/leave-requests/${id}/reject`, { note }),
};

export const StudentLeaveRequestsApi = {
  list: (params?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; studentId?: string }) =>
    http.get<StudentLeaveRequest[]>('/student-leave-requests', { params }),
  approve: (id: string, note?: string) => http.patch(`/student-leave-requests/${id}/approve`, { note }),
  reject: (id: string, note?: string) => http.patch(`/student-leave-requests/${id}/reject`, { note }),
};

export const UsersApi = {
  list: () => http.get<AppUser[]>('/users'),
  create: (data: { name: string; phone: string; password: string; role: AppRole; teacherId?: string }) =>
    http.post<AppUser>('/users', data),
  update: (id: string, data: Partial<{ name: string; phone: string; password: string; role: AppRole; teacherId?: string }>) =>
    http.patch<AppUser>(`/users/${id}`, data),
  remove: (id: string) => http.delete(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) => http.patch<AppUser>(`/users/${id}/password`, { newPassword }),
};

export const ProfileApi = {
  me: () => http.get<AppUser>('/users/me'),
  updatePassword: (currentPassword: string, newPassword: string) =>
    http.patch<AppUser>('/users/me/password', { currentPassword, newPassword }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<AppUser>('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  removeAvatar: () => http.delete<AppUser>('/users/me/avatar'),
};

export interface TeacherEarningRow {
  teacherId: string;
  fullName: string;
  salaryPct: number;
  mixedPct?: boolean;
  gross: number;
  earning: number;
  groupCount: number;
  studentCount: number;
}
export interface TeacherEarningHistoryRow {
  period: string;
  gross: number;
  earning: number;
  groupCount: number;
  studentCount: number;
}
export const TeacherEarningsApi = {
  forPeriod: (period?: string) =>
    http.get<{ period: string; rows: TeacherEarningRow[]; totalEarning: number }>('/payments/teacher-earnings', {
      params: { period },
    }),
  history: (teacherId: string, months?: number) =>
    http.get<TeacherEarningHistoryRow[]>(`/payments/teacher-earnings/${teacherId}/history`, { params: { months } }),
};

export interface Feedback {
  id: string;
  studentId: string;
  teacherId: string;
  groupId: string;
  lessonId?: string;
  sentiment: 'POSITIVE' | 'NEGATIVE';
  comment?: string;
  createdAt: string;
}
export interface FeedbackSummary {
  positive: number;
  negative: number;
  total: number;
  recent: Feedback[];
}
export const FeedbackApi = {
  list: (params?: { teacherId?: string; studentId?: string; groupId?: string }) =>
    http.get<Feedback[]>('/feedback', { params }),
  summary: (teacherId: string) => http.get<FeedbackSummary>(`/feedback/summary/${teacherId}`),
};

export const HomeworkApi = {
  list: (groupId?: string) => http.get<Homework[]>('/homework', { params: { groupId } }),
  create: (data: { groupId: string; teacherId: string; title: string; description?: string; videoUrl?: string; dueDate?: string; file?: File }) => {
    const form = new FormData();
    form.append('groupId', data.groupId);
    form.append('teacherId', data.teacherId);
    form.append('title', data.title);
    if (data.description) form.append('description', data.description);
    if (data.videoUrl) form.append('videoUrl', data.videoUrl);
    if (data.dueDate) form.append('dueDate', data.dueDate);
    if (data.file) form.append('file', data.file);
    return http.post<Homework>('/homework', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  remove: (id: string) => http.delete(`/homework/${id}`),
};

export const GradesApi = {
  list: (params?: { studentId?: string; groupId?: string }) => http.get<Grade[]>('/grades', { params }),
  summary: (studentId: string) => http.get<GradeSummary>(`/grades/summary/${studentId}`),
  create: (data: { studentId: string; groupId: string; teacherId: string; lessonId?: string; score: number; comment?: string }) =>
    http.post<Grade>('/grades', data),
};

export const DiscountsApi = {
  runMonthly: () => http.post<{ discountedCount: number; discountPct: number }>('/discounts/run-monthly'),
};
