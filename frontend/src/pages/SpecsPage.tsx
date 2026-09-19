import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

type Spec = { id: string; code: string; name: string; description: string; _count: { items: number } };

export default function SpecsPage() {
  const [rows, setRows] = useState<Spec[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  const load = () => api<Spec[]>('/api/specs').then(setRows);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const spec = await api<Spec>('/api/specs', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
      });
      nav(`/office/specs/${spec.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Спецификации</h1>
          <p>Многоуровневый состав изделия. Откройте карточку для табличного ввода.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Обозначение" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Наименование" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn">Новая спецификация</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Обозначение</th>
            <th>Наименование</th>
            <th>Позиций</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/office/specs/${s.id}`}>{s.code}</Link>
              </td>
              <td>{s.name}</td>
              <td>{s._count.items}</td>
              <td>
                <Link to={`/office/specs/${s.id}/tech`}>Технология</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
