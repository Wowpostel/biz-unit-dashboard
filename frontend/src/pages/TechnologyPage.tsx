import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, isSuper } from '../api';
import { useAuth } from '../auth';

type Post = { id: string; name: string };
type OpType = { id: string; name: string };
type Image = { id: string; filename: string };
type Op = {
  id: string;
  seq: number;
  name: string;
  postId: string | null;
  operationTypeId: string | null;
  timeNormHours: number;
  instruction: string;
  images: Image[];
};
type Item = {
  id: string;
  parentId: string | null;
  designation: string;
  name: string;
  kind: string;
  operations: Op[];
};

export default function TechnologyPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = isSuper(user?.role) || user?.role === 'ADMIN' || user?.role === 'TECHNOLOGIST';
  const [items, setItems] = useState<Item[]>([]);
  const [code, setCode] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [types, setTypes] = useState<OpType[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [ops, setOps] = useState<Op[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function load() {
    const spec = await api<{ code: string; items: Item[] }>(`/api/specs/${id}`);
    setCode(spec.code);
    setItems(spec.items.filter((i) => i.kind !== 'MATERIAL'));
    setPosts(await api<Post[]>('/api/posts'));
    setTypes(await api<OpType[]>('/api/operation-types'));
    const current = sel ?? spec.items.find((i) => i.kind !== 'MATERIAL')?.id ?? null;
    setSel(current);
    const found = spec.items.find((i) => i.id === current);
    setOps(found?.operations ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function selectItem(itemId: string) {
    setSel(itemId);
    setOps(items.find((i) => i.id === itemId)?.operations ?? []);
    setSaved('');
  }

  function patchOp(opId: string, upd: Partial<Op>) {
    setOps((rows) => rows.map((o) => (o.id === opId ? { ...o, ...upd } : o)));
  }

  function addOp() {
    const seq = (ops.length ? ops[ops.length - 1].seq : 0) + 10;
    setOps((rows) => [
      ...rows,
      {
        id: `tmp-${Date.now()}`,
        seq,
        name: '',
        postId: posts[0]?.id ?? null,
        operationTypeId: types[0]?.id ?? null,
        timeNormHours: 0.5,
        instruction: '',
        images: [],
      },
    ]);
  }

  async function save() {
    if (!sel) return;
    setError('');
    try {
      await api(`/api/spec-items/${sel}/operations`, {
        method: 'PUT',
        body: JSON.stringify({
          operations: ops.map((o) => ({
            id: o.id.startsWith('tmp-') ? undefined : o.id,
            seq: Number(o.seq),
            name: o.name,
            postId: o.postId,
            operationTypeId: o.operationTypeId,
            timeNormHours: Number(o.timeNormHours),
            instruction: o.instruction,
          })),
        }),
      });
      await load();
      setSaved('Технология сохранена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function upload(opId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    await api(`/api/tech-operations/${opId}/images`, { method: 'POST', body: fd });
    await load();
  }

  const current = items.find((i) => i.id === sel);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Технология {code}</h1>
          <p>
            Операции, норма, пост, текст и изображения.{' '}
            <Link to={`/office/specs/${id}`}>← состав</Link>
          </p>
        </div>
        {canEdit && (
          <button className="btn amber" onClick={save} disabled={!sel}>
            Сохранить операции
          </button>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <div className="grid-2">
        <div className="card">
          <h3>Позиции</h3>
          <table className="data">
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  onClick={() => selectItem(it.id)}
                  style={{ background: sel === it.id ? '#f7e7c6' : undefined, cursor: 'pointer' }}
                >
                  <td>
                    <div>Номер {it.designation}</div>
                    <div className="muted">Наименование {it.name}</div>
                  </td>
                  <td>{it.operations.length} оп.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>
            {current ? `Номер ${current.designation} · ${current.name}` : 'Выберите позицию'}
          </h3>
          {canEdit && (
          <button className="btn" type="button" onClick={addOp} disabled={!sel}>
            + Операция
          </button>
          )}
          {ops.map((o) => (
            <div key={o.id} className="card" style={{ marginTop: 12 }}>
              <div className="form-row">
                <input
                  style={{ width: 70 }}
                  type="number"
                  value={o.seq}
                  onChange={(e) => patchOp(o.id, { seq: Number(e.target.value) })}
                />
                <input
                  placeholder="Название операции"
                  value={o.name}
                  onChange={(e) => patchOp(o.id, { name: e.target.value })}
                />
                <select
                  value={o.postId ?? ''}
                  onChange={(e) => patchOp(o.id, { postId: e.target.value || null })}
                >
                  <option value="">Пост…</option>
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={o.operationTypeId ?? ''}
                  onChange={(e) => patchOp(o.id, { operationTypeId: e.target.value || null })}
                >
                  <option value="">Вид…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  style={{ width: 90 }}
                  type="number"
                  step="0.01"
                  value={o.timeNormHours}
                  onChange={(e) => patchOp(o.id, { timeNormHours: Number(e.target.value) })}
                />
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setOps((rows) => rows.filter((x) => x.id !== o.id))}
                >
                  ×
                </button>
              </div>
              <textarea
                style={{ width: '100%', minHeight: 70 }}
                placeholder="Текст технологии"
                value={o.instruction}
                onChange={(e) => patchOp(o.id, { instruction: e.target.value })}
              />
              <div>
                {o.images.map((img) => (
                  <img
                    key={img.id}
                    className="tech-img"
                    src={`/api/files/tech-images/${img.id}`}
                    alt={img.filename}
                  />
                ))}
                {!o.id.startsWith('tmp-') && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(o.id, f);
                    }}
                  />
                )}
                {o.id.startsWith('tmp-') && (
                  <span className="muted"> Сохраните операцию, чтобы прикрепить фото</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
