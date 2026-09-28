import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';

type Post = { id: string; name: string };
type Row = {
  id: string;
  code: string;
  name: string;
  defaultPostId: string | null;
  defaultPost: Post | null;
};

type Draft = { code: string; name: string; defaultPostId: string };

function toDraft(r: Row): Draft {
  return {
    code: r.code,
    name: r.name,
    defaultPostId: r.defaultPostId ?? '',
  };
}

export default function OperationTypesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [defaultPostId, setDefaultPostId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    setRows(await api<Row[]>('/api/operation-types'));
    setPosts(await api<Post[]>('/api/posts'));
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved('');
    try {
      const created = await api<Row>('/api/operation-types', {
        method: 'POST',
        body: JSON.stringify({ code, name, defaultPostId: defaultPostId || null }),
      });
      setCode('');
      setName('');
      setDefaultPostId('');
      await load();
      setEditingId(created.id);
      setDraft(toDraft(created));
      setSaved('Вид операции создан.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  function openEdit(row: Row) {
    setError('');
    setSaved('');
    setEditingId(row.id);
    setDraft(toDraft(row));
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setError('');
    try {
      await api(`/api/operation-types/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: draft.code,
          name: draft.name,
          defaultPostId: draft.defaultPostId || null,
        }),
      });
      setSaved('Вид операции сохранён.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Виды операций</h1>
          <p>Справочник для набора технологии. Пост по умолчанию подставляется, когда набор копируют на деталь.</p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={defaultPostId} onChange={(e) => setDefaultPostId(e.target.value)}>
          <option value="">Пост по умолчанию…</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn">Добавить</button>
      </form>
      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Пост по умолчанию</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ outline: editingId === r.id ? '2px solid var(--amber)' : undefined }}>
              <td>{r.code}</td>
              <td>{r.name}</td>
              <td>{r.defaultPost?.name ?? '—'}</td>
              <td>
                <div className="row-actions">
                  <button className="btn ghost" type="button" onClick={() => openEdit(r)}>
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
          <h3>Карточка вида операции</h3>
          <div className="form-row">
            <input
              placeholder="Код"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <input
              placeholder="Название"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <select
              value={draft.defaultPostId}
              onChange={(e) => setDraft({ ...draft, defaultPostId: e.target.value })}
            >
              <option value="">Пост по умолчанию…</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
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
