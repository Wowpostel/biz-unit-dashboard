import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import OfficeLayout from './pages/OfficeLayout';
import DashboardPage from './pages/DashboardPage';
import PostsPage from './pages/PostsPage';
import EmployeesPage from './pages/EmployeesPage';
import UsersPage from './pages/UsersPage';
import OperationTypesPage from './pages/OperationTypesPage';
import SpecsPage from './pages/SpecsPage';
import SpecEditorPage from './pages/SpecEditorPage';
import TechnologyPage from './pages/TechnologyPage';
import OrdersPage from './pages/OrdersPage';
import OrderPage from './pages/OrderPage';
import PrintQrPage from './pages/PrintQrPage';
import KioskPage from './pages/KioskPage';

function Gate({ office }: { office?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (office && user.role === 'OPERATOR') return <Navigate to="/kiosk" replace />;
  return office ? <OfficeLayout /> : <KioskPage />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <div className="boot">Загрузка…</div>
          ) : user ? (
            <Navigate to={user.role === 'OPERATOR' ? '/kiosk' : '/office'} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/kiosk" element={<Gate />} />
      <Route path="/office" element={<Gate office />}>
        <Route index element={<DashboardPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="operation-types" element={<OperationTypesPage />} />
        <Route path="specs" element={<SpecsPage />} />
        <Route path="specs/:id" element={<SpecEditorPage />} />
        <Route path="specs/:id/tech" element={<TechnologyPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderPage />} />
        <Route path="launches/:id/print" element={<PrintQrPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
