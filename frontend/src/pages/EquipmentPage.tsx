import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Post = { id: string; name: string; code: string };
type Eq = {
  id: string;
  code: string;
  name: string;
  inventoryNo: string;
  postId: string | null;
  post: Post | null;
  isActive: boolean;
};

type Draft = {
  code: string;
  name: string;
  inventoryNo: string;
  postId: string;
  isActive: boolean;
};

function toDraft(r: Eq): Draft {
  return {
    code: r.code,
    name: r.name,
    inventoryNo: r.inventoryNo ?? '',
    postId: r.postId ?? '',
    isActive: r.isActive,
  };
}

export default function EquipmentPage() {
  const [rows, setRows] = useState<Eq[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [inventoryNo, setInventoryNo] = useState('');
  const [postId, setPostId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    setRows(await api<Eq[]>('/api/equipment'));
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
      const created = await api<Eq>('/api/equipment', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          inventoryNo,
          postId: postId || null,
        }),
      });
      setCode('');
      setName('');
      setInventoryNo('');
      setPostId('');
      await load();
      setEditingId(created.id);
      setDraft(toDraft(created));
      setSaved('Станок создан. При необходимости поправьте карточку.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  function openEdit(row: Eq) {
    setError('');
    setSaved('');
    setEditingId(row.id);
    setDraft(toDraft(row));
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setError('');
    try {
      await api(`/api/equipment/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: draft.code,
          name: draft.name,
          inventoryNo: draft.inventoryNo,
          postId: draft.postId || null,
          isActive: draft.isActive,
        }),
      });
      setSaved('Карточка станка сохранена.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Оборудование</h1>
          <p>
            Станки и единицы учёта. Пост — отдельный справочник: к{' '}
            <Link to="/office/posts">посту</Link> крепят несколько станков.
          </p>
        </div>
      </div>
      <form className="form-row" onSubmit={onSubmit}>
        <input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Название станка" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Инв. №" value={inventoryNo} onChange={(e) => setInventoryNo(e.target.value)} />
        <select value={postId} onChange={(e) => setPostId(e.target.value)}>
          <option value="">Пост не назначен</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn">Добавить станок</button>
      </form>
      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Инв. №</th>
            <th>Пост</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ outline: editingId === r.id ? '2px solid var(--amber)' : undefined }}>
              <td>{r.code}</td>
              <td>
                {r.name}
                {!r.isActive && <span className="muted"> · неактивен</span>}
              </td>
              <td>{r.inventoryNo || '—'}</td>
              <td>{r.post?.name ?? '—'}</td>
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
          <h3>Карточка станка</h3>
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
            <input
              placeholder="Инв. №"
              value={draft.inventoryNo}
              onChange={(e) => setDraft({ ...draft, inventoryNo: e.target.value })}
            />
            <select
              value={draft.postId}
              onChange={(e) => setDraft({ ...draft, postId: e.target.value })}
            >
              <option value="">Пост не назначен</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="kit-check">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Активен
            </label>
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
