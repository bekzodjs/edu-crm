import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Groups from './pages/Groups';
import Teachers from './pages/Teachers';
import TeacherDetail from './pages/TeacherDetail';
import Schedule from './pages/Schedule';
import AttendanceHub from './pages/AttendanceHub';
import PaymentsHub from './pages/PaymentsHub';
import Arizalar from './pages/Arizalar';
import Users from './pages/Users';
import Profile from './pages/Profile';
import ErrorToaster from './components/ErrorToaster';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:id" element={<TeacherDetail />} />
            <Route path="/schedule" element={<Schedule />} />

            <Route path="/attendance" element={<AttendanceHub />} />
            <Route path="/attendance-report" element={<Navigate to="/attendance?tab=report" replace />} />
            <Route path="/homework" element={<Navigate to="/attendance?tab=homework" replace />} />
            <Route path="/grades" element={<Navigate to="/attendance?tab=grades" replace />} />
            <Route path="/teacher-attendance" element={<Navigate to="/attendance?tab=teacher" replace />} />

            <Route path="/payments" element={<PaymentsHub />} />
            <Route path="/debts" element={<Navigate to="/payments?tab=debts" replace />} />

            <Route path="/arizalar" element={<Arizalar />} />
            <Route path="/leave-requests" element={<Navigate to="/arizalar" replace />} />
            <Route path="/parent-requests" element={<Navigate to="/arizalar" replace />} />
            <Route path="/users" element={<Users />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
        <ErrorToaster />
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
