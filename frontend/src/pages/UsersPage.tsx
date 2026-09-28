import { FormEvent, useEffect, useState } from 'react';
import { api, isSuper, roleLabel, type Role } from '../api';
import { useAuth } from '../auth';

type Employee = { id: string; fullName: string };
type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  employee: Employee | null;
};

type Draft = {
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  employeeId: string;
  password: string;
};

function toDraft(u: User): Draft {
  return {
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    employeeId: u.employee?.id ?? '',
    password: '',
  };
}

export default function UsersPage() {
  const { user } = useAuth();
  const actorSuper = isSuper(user?.role);
  const [rows, setRows] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [employeeId, setEmployeeId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const createRoles = (Object.keys(roleLabel) as Role[]).filter((r) => actorSuper || r !== 'SUPER');
  const superCount = rows.filter((r) => r.role === 'SUPER' && r.isActive).length;

  const load = async () => {
    setRows(await api<User[]>('/api/users'));
    setEmployees(await api<Employee[]>('/api/employees'));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved('');
    try {
      const created = await api<User>('/api/users', {
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
      setRole('OPERATOR');
      setEmployeeId('');
      await load();
      setEditingId(created.id);
      setDraft(toDraft(created));
      setSaved('Пользователь создан.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  function openEdit(row: User) {
    setError('');
    setSaved('');
    setEditingId(row.id);
    setDraft(toDraft(row));
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setError('');
    try {
      await api(`/api/users/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: draft.fullName,
          email: draft.email,
          role: draft.role,
          isActive: draft.isActive,
          employeeId: draft.employeeId || null,
          ...(draft.password.trim() ? { password: draft.password.trim() } : {}),
        }),
      });
      setSaved('Карточка пользователя сохранена.');
      setDraft({ ...draft, password: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  const editing = rows.find((r) => r.id === editingId);
  const lockSuperFields =
    !!editing &&
    editing.role === 'SUPER' &&
    (!actorSuper || (editing.isActive && superCount <= 1 && editing.role === 'SUPER'));
  const editRoles = (Object.keys(roleLabel) as Role[]).filter(
    (r) => actorSuper || r !== 'SUPER' || editing?.role === 'SUPER',
  );

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
          {createRoles.map((r) => (
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
      {saved && <p className="muted">{saved}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Почта</th>
            <th>Роль</th>
            <th>Сотрудник</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} style={{ outline: editingId === u.id ? '2px solid var(--amber)' : undefined }}>
              <td>
                {u.fullName}
                {!u.isActive && <span className="muted"> · неактивен</span>}
              </td>
              <td>{u.email}</td>
              <td>{roleLabel[u.role]}</td>
              <td>{u.employee?.fullName ?? '—'}</td>
              <td>
                <div className="row-actions">
                  <button className="btn ghost" type="button" onClick={() => openEdit(u)}>
                    Изменить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft && editingId && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Карточка пользователя</h3>
          <div className="form-row">
            <input
              placeholder="ФИО"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
            />
            <input
              placeholder="Почта"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <select
              value={draft.role}
              disabled={lockSuperFields}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
            >
              {editRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
            <select
              value={draft.employeeId}
              onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
            >
              <option value="">Без сотрудника</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
            <input
              placeholder="Новый пароль (пусто — не менять)"
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <label className="kit-check">
              <input
                type="checkbox"
                checked={draft.isActive}
                disabled={lockSuperFields}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Активен
            </label>
          </div>
          {lockSuperFields && (
            <p className="muted">Роль и активность последнего суперпользователя не снимаются.</p>
          )}
          <button className="btn amber" type="button" onClick={() => void saveEdit()}>
            Сохранить
          </button>
          <button
            className="btn ghost"
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setEditingId(null);
              setDraft(null);
            }}
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
