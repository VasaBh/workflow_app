'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface KVPair {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  disabled?: boolean;
}

export default function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  disabled = false,
}: KeyValueEditorProps) {
  const toRows = (obj: Record<string, unknown>): KVPair[] =>
    Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v ?? '') }));

  const [rows, setRows] = useState<KVPair[]>(toRows(value));

  const emit = (updated: KVPair[]) => {
    const obj: Record<string, unknown> = {};
    for (const r of updated) {
      if (r.key.trim()) obj[r.key.trim()] = r.value;
    }
    onChange(obj);
  };

  const update = (idx: number, field: 'key' | 'value', val: string) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r));
    setRows(next);
    emit(next);
  };

  const add = () => {
    const next = [...rows, { key: '', value: '' }];
    setRows(next);
  };

  const remove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    emit(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            type="text"
            value={row.key}
            onChange={(e) => update(idx, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <input
            type="text"
            value={row.value}
            onChange={(e) => update(idx, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          {!disabled && (
            <button
              onClick={() => remove(idx)}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add entry
        </button>
      )}
    </div>
  );
}
