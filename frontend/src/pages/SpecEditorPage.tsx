import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Kind = 'ASSEMBLY' | 'PART' | 'MATERIAL';

type Row = {
  clientId: string;
  id?: string;
  parentClientId: string | null;
  designation: string;
  name: string;
  qty: number;
  unit: string;
  kind: Kind;
};

const kindRu: Record<Kind, string> = {
  ASSEMBLY: 'Сборка',
  PART: 'Деталь',
  MATERIAL: 'Материал',
};

function levelOf(rows: Row[], row: Row): number {
  let n = 0;
  let pid = row.parentClientId;
  const map = new Map(rows.map((r) => [r.clientId, r]));
  while (pid) {
    n += 1;
    pid = map.get(pid)?.parentClientId ?? null;
    if (n > 20) break;
  }
  return n;
}

export default function SpecEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TECHNOLOGIST';
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{
      code: string;
      name: string;
      items: {
        id: string;
        parentId: string | null;
        designation: string;
        name: string;
        qty: number;
        unit: string;
        kind: Kind;
      }[];
    }>(`/api/specs/${id}`)
      .then((spec) => {
        setCode(spec.code);
        setName(spec.name);
        const idToClient = new Map<string, string>();
        spec.items.forEach((it, i) => idToClient.set(it.id, it.id || `row-${i}`));
        setRows(
          spec.items.map((it) => ({
            clientId: it.id,
            id: it.id,
            parentClientId: it.parentId,
            designation: it.designation,
            name: it.name,
            qty: it.qty,
            unit: it.unit,
            kind: it.kind,
          })),
        );
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const display = useMemo(() => {
    const children = new Map<string | null, Row[]>();
    for (const r of rows) {
      const key = r.parentClientId;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(r);
    }
    const out: Row[] = [];
    const walk = (parent: string | null) => {
      for (const r of children.get(parent) ?? []) {
        out.push(r);
        walk(r.clientId);
      }
    };
    walk(null);
    return out;
  }, [rows]);

  function patch(clientId: string, upd: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.clientId === clientId ? { ...r, ...upd } : r)));
  }

  function addRow(parentClientId: string | null, after?: string) {
    const row: Row = {
      clientId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parentClientId,
      designation: '',
      name: '',
      qty: 1,
      unit: 'шт',
      kind: 'PART',
    };
    setRows((rs) => {
      if (!after) return [...rs, row];
      const idx = rs.findIndex((r) => r.clientId === after);
      const copy = [...rs];
      copy.splice(idx + 1, 0, row);
      return copy;
    });
    setSel(row.clientId);
  }

  function onKey(e: KeyboardEvent, row: Row) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addRow(row.parentClientId, row.clientId);
    }
  }

  async function save() {
    setError('');
    setSaved('');
    try {
      await api(`/api/specs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ code, name }),
      });
      await api(`/api/specs/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify({
          items: display.map((r, i) => ({
            id: r.id,
            clientId: r.clientId,
            parentClientId: r.parentClientId,
            sortOrder: i,
            designation: r.designation,
            name: r.name,
            qty: Number(r.qty) || 1,
            unit: r.unit || 'шт',
            kind: r.kind,
          })),
        }),
      });
      const spec = await api<{
        items: {
          id: string;
          parentId: string | null;
          designation: string;
          name: string;
          qty: number;
          unit: string;
          kind: Kind;
        }[];
      }>(`/api/specs/${id}`);
      setRows(
        spec.items.map((it) => ({
          clientId: it.id,
          id: it.id,
          parentClientId: it.parentId,
          designation: it.designation,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          kind: it.kind,
        })),
      );
      setSaved('Сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const selected = rows.find((r) => r.clientId === sel);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Спецификация {code}</h1>
          <p>
            Таблица как в Excel: Enter — строка того же уровня, «Вложить» — дочерняя позиция.{' '}
            <Link to={`/office/specs/${id}/tech`}>Технология →</Link>
          </p>
        </div>
        {canEdit && (
          <button className="btn amber" onClick={save}>
            Сохранить
          </button>
        )}
      </div>
      <div className="form-row">
        <input value={code} onChange={(e) => setCode(e.target.value)} readOnly={!canEdit} />
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 280 }} readOnly={!canEdit} />
      </div>
      {canEdit && (
      <div className="form-row">
        <button className="btn" type="button" onClick={() => addRow(null)}>
          + Строка
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={!selected}
          onClick={() => selected && addRow(selected.clientId)}
        >
          Вложить
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={!selected}
          onClick={() => setRows((rs) => rs.filter((r) => r.clientId !== sel && r.parentClientId !== sel))}
        >
          Удалить
        </button>
      </div>
      )}
      {error && <p className="err">{error}</p>}
      {saved && <p className="muted">{saved}</p>}
      <table className="data">
        <thead>
          <tr>
            <th style={{ width: 40 }}>Ур.</th>
            <th>Обозначение</th>
            <th>Наименование</th>
            <th style={{ width: 90 }}>Кол-во</th>
            <th style={{ width: 80 }}>Ед.</th>
            <th style={{ width: 130 }}>Вид</th>
          </tr>
        </thead>
        <tbody>
          {display.map((r) => {
            const lvl = levelOf(rows, r);
            return (
              <tr
                key={r.clientId}
                onClick={() => setSel(r.clientId)}
                style={{ outline: sel === r.clientId ? '2px solid var(--amber)' : undefined }}
              >
                <td>{lvl + 1}</td>
                <td style={{ paddingLeft: 8 + lvl * 18 }}>
                  <input
                    value={r.designation}
                    onChange={(e) => patch(r.clientId, { designation: e.target.value })}
                    onKeyDown={(e) => onKey(e, r)}
                    readOnly={!canEdit}
                  />
                </td>
                <td>
                  <input
                    value={r.name}
                    onChange={(e) => patch(r.clientId, { name: e.target.value })}
                    onKeyDown={(e) => onKey(e, r)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    value={r.qty}
                    onChange={(e) => patch(r.clientId, { qty: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input value={r.unit} onChange={(e) => patch(r.clientId, { unit: e.target.value })} />
                </td>
                <td>
                  <select value={r.kind} onChange={(e) => patch(r.clientId, { kind: e.target.value as Kind })}>
                    {(Object.keys(kindRu) as Kind[]).map((k) => (
                      <option key={k} value={k}>
                        {kindRu[k]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
