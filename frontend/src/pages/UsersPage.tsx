import { FormEvent, useEffect, useState } from 'react';
import { api, roleLabel, type Role } from '../api';

type Employee = { id: string; fullName: string };
type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  employee: Employee | null;
};

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setRows(await api<User[]>('/api/users'));
    setEmployees(await api<Employee[]>('/api/employees'));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          employeeId: employeeId || undefined,
        }),
      });
      setEmail('');
      setPassword('');
      setFullName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Пользователи и роли</h1>
          <p>
            Суперпользователь видит весь офис. Администратор, технолог, диспетчер, оператор — по своим
            правам. Оператор после входа попадает только на терминал.
          </p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]}
            </option>
          ))}
        </select>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">Без сотрудника</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName}
            </option>
          ))}
        </select>
        <button className="btn">Создать</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Почта</th>
            <th>Роль</th>
            <th>Сотрудник</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.fullName}</td>
              <td>{u.email}</td>
              <td>{roleLabel[u.role]}</td>
              <td>{u.employee?.fullName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
