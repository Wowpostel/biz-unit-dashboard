import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type Row = { id: string; code: string; name: string };

export default function OperationTypesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => api<Row[]>('/api/operation-types').then(setRows);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/operation-types', { method: 'POST', body: JSON.stringify({ code, name }) });
      setCode('');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Виды операций</h1>
          <p>Токарная, фрезерная, сборка — справочник для технологии.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn">Добавить</button>
      </form>
      {error && <p className="err">{error}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
