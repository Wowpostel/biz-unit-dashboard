import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { roleLabel } from '../api';

export default function OfficeLayout() {
  const { user, logout } = useAuth();
  const role = user?.role;
  const tech = role === 'ADMIN' || role === 'TECHNOLOGIST';
  const disp = role === 'ADMIN' || role === 'DISPATCHER';
  const admin = role === 'ADMIN';

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          ERPEVV
          <small>{user?.tenantName}</small>
        </div>
        <nav>
          {disp && <NavLink to="/office" end>Дашборд</NavLink>}
          {disp && <NavLink to="/office/orders">Заказы</NavLink>}
          <NavLink to="/office/specs">Спецификации</NavLink>
          {tech && <NavLink to="/office/posts">Посты</NavLink>}
          {tech && <NavLink to="/office/employees">Сотрудники</NavLink>}
          {tech && <NavLink to="/office/operation-types">Виды операций</NavLink>}
          {admin && <NavLink to="/office/users">Пользователи</NavLink>}
          <NavLink to="/kiosk">Терминал</NavLink>
        </nav>
        <div className="who">
          <div>{user?.fullName}</div>
          <div>{user ? roleLabel[user.role] : ''}</div>
          <button type="button" onClick={() => logout()}>Выйти</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
