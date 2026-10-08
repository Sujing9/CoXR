import { useState, useRef, useCallback } from 'react';
import { Dialog } from 'radix-ui';
import Papa from 'papaparse';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UploadIcon,
  GlobeIcon,
  DatabaseIcon,
  CheckIcon,
  AlertTriangleIcon,
  XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDoc } from '@/data/DocContext';
import { request } from '@/api/client';
import type { FieldDef, FieldType, RecordTypeDef, RecordTypeId, SelectOption } from '@coxr/shared';
import { uuid } from '@coxr/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'file' | 'http' | 'database';
type DbType = 'pg' | 'sqlite';
type Step = 'source_type' | 'source_config' | 'field_select' | 'field_mapping' | 'confirm';

interface PgConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface ColumnMapping {
  sourceKey: string;
  include: boolean;
  targetName: string;
  targetType: FieldType;
  sampleValues: string[];
}

interface PgTable {
  schema: string;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  longText: '长文本',
  number: '数字',
  boolean: '勾选',
  select: '单选',
  multiSelect: '多选',
  date: '日期',
  url: '链接',
};

const FIELD_TYPES: FieldType[] = [
  'text', 'longText', 'number', 'boolean', 'select', 'multiSelect', 'date', 'url',
];

const OPTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#3b82f6', '#14b8a6',
  '#f97316', '#84cc16', '#06b6d4', '#a855f7',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomColor(existing: string[]): string {
  const unused = OPTION_COLORS.filter((c) => !existing.includes(c));
  const pool = unused.length > 0 ? unused : OPTION_COLORS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** 在 JSON 对象中递归找出所有数组路径及其长度 */
function findArrayPaths(obj: unknown, path = ''): { path: string; length: number }[] {
  if (Array.isArray(obj) && obj.length > 0) {
    return [{ path: path || '(root)', length: obj.length }];
  }
  if (obj && typeof obj === 'object') {
    const results: { path: string; length: number }[] = [];
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      results.push(...findArrayPaths(val, childPath));
    }
    return results;
  }
  return [];
}

/** 根据路径字符串取值，支持点分嵌套（如 'data.items'） */
function getByPath(obj: unknown, path: string): unknown {
  if (path === '(root)') return obj;
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** 将任意值转换为可显示的字符串（用于样本预览） */
function toDisplayStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** 将源字段值转换为目标 FieldType 所需的 FieldValue */
function convertValue(
  raw: unknown,
  type: FieldType,
  options?: SelectOption[],
): import('@coxr/shared').FieldValue {
  const str = toDisplayStr(raw).trim();
  if (str === '') return null;

  switch (type) {
    case 'number': {
      const n = Number(str);
      return isNaN(n) ? null : n;
    }
    case 'boolean': {
      const lower = str.toLowerCase();
      return ['true', '1', 'yes', '是', 'y'].includes(lower);
    }
    case 'date': {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    case 'select': {
      const opt = options?.find((o) => o.name === str);
      return opt ? opt.id : null;
    }
    case 'multiSelect': {
      const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
      if (!options?.length) return parts;
      return parts.map((p) => options.find((o) => o.name === p)?.id).filter(Boolean) as string[];
    }
    default:
      return str;
  }
}

/** 从列数据中收集唯一值并生成 SelectOption 列表 */
function buildSelectOptions(columnValues: string[]): SelectOption[] {
  const unique = [...new Set(columnValues.map((v) => v.trim()).filter(Boolean))].slice(0, 100);
  const colors: string[] = [];
  return unique.map((name) => {
    const color = randomColor(colors);
    colors.push(color);
    return { id: uuid(), name, color };
  });
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const labels: Record<Step, string> = {
    source_type: '数据源',
    source_config: '配置',
    field_select: '选择',
    field_mapping: '映射',
    confirm: '确认',
  };
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
              i < idx
                ? 'bg-indigo-600 text-white'
                : i === idx
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-500',
            )}
          >
            {i < idx ? <CheckIcon size={10} strokeWidth={3} /> : i + 1}
          </div>
          <span className={cn('text-xs font-semibold', i === idx ? 'text-slate-900' : 'text-slate-400')}>
            {labels[s]}
          </span>
          {i < steps.length - 1 && <div className="h-px w-4 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Source Type ───────────────────────────────────────────────────────

function SourceTypeStep({
  value,
  onChange,
}: {
  value: SourceType | null;
  onChange: (t: SourceType) => void;
}) {
  const options: { type: SourceType; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      type: 'file',
      label: '本地文件',
      desc: '支持 CSV、JSON、Excel (.xlsx)',
      icon: <UploadIcon size={20} strokeWidth={2.5} />,
    },
    {
      type: 'http',
      label: 'HTTP 请求',
      desc: '从远程 API 获取 JSON 数据',
      icon: <GlobeIcon size={20} strokeWidth={2.5} />,
    },
    {
      type: 'database',
      label: '数据库',
      desc: '连接 PostgreSQL 或上传 SQLite 文件',
      icon: <DatabaseIcon size={20} strokeWidth={2.5} />,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-500">选择要导入数据的来源类型</p>
      <div className="grid grid-cols-3 gap-3">
        {options.map(({ type, label, desc, icon }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all',
              value === type
                ? 'border-indigo-600 bg-indigo-50 text-slate-900 ring-1 ring-indigo-600'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <div className={value === type ? 'text-indigo-600' : 'text-slate-400'}>{icon}</div>
            <span className="text-sm font-bold">{label}</span>
            <span className="text-[11px] font-medium text-slate-400 leading-tight">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Source Config ────────────────────────────────────────────────────

function FileConfigStep({
  onLoad,
}: {
  onLoad: (rows: Record<string, unknown>[], hint: 'csv' | 'json' | 'excel', raw?: unknown) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) {
        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => {
              onLoad(res.data as Record<string, unknown>[], 'csv');
              resolve();
            },
            error: (err) => reject(new Error(err.message)),
          });
        });
      } else if (name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        onLoad(Array.isArray(parsed) ? parsed : [parsed], 'json', parsed);
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheets = wb.SheetNames;
        onLoad([], 'excel', { file, sheets, wb });
      } else {
        setError('不支持的文件格式，请上传 .csv、.json 或 .xlsx 文件');
      }
    } catch (e: any) {
      setError(e.message ?? '文件解析失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors',
          dragOver ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <UploadIcon size={28} className="text-slate-400" strokeWidth={2.5} />
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">拖拽文件到此处或点击选择</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">支持 .csv · .json · .xlsx · .xls</p>
        </div>
        {loading && <p className="text-xs font-bold text-indigo-600">解析中…</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          <AlertTriangleIcon size={12} strokeWidth={2.5} /> {error}
        </p>
      )}
    </div>
  );
}

function HttpConfigStep({
  onLoad,
}: {
  onLoad: (rows: Record<string, unknown>[], raw: unknown) => void;
}) {
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHeader = () => setHeaders((h) => [...h, { key: '', value: '' }]);
  const updateHeader = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setHeaders((h) => h.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  const removeHeader = (i: number) => setHeaders((h) => h.filter((_, idx) => idx !== i));

  const handleFetch = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const headerMap = Object.fromEntries(
        headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]),
      );
      const res = await request<{ data: unknown }>('/api/import/fetch-url', {
        method: 'POST',
        body: { url: url.trim(), headers: headerMap },
      });
      const data = res.data;
      const rows = Array.isArray(data) ? data : [data];
      onLoad(rows as Record<string, unknown>[], data);
    } catch (e: any) {
      setError(e.message ?? '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">请求 URL</label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://api.example.com/data"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">请求头（可选）</label>
          <button
            onClick={addHeader}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            + 添加
          </button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={h.key}
              onChange={(e) => updateHeader(i, { key: e.target.value })}
              placeholder="Header-Name"
              className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
            />
            <input
              type="text"
              value={h.value}
              onChange={(e) => updateHeader(i, { value: e.target.value })}
              placeholder="value"
              className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
            />
            <button
              onClick={() => removeHeader(i)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <XIcon size={12} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleFetch}
        disabled={!url.trim() || loading}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:bg-indigo-700 shadow-sm"
      >
        {loading ? '获取中…' : '获取数据'}
      </button>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          <AlertTriangleIcon size={12} strokeWidth={2.5} /> {error}
        </p>
      )}
    </div>
  );
}

function DbConfigStep({
  onLoad,
}: {
  onLoad: (tables: PgTable[] | string[], dbType: DbType, fileBase64?: string) => void;
}) {
  const [dbType, setDbType] = useState<DbType>('pg');
  const [pg, setPg] = useState<PgConfig>({
    host: '', port: '5432', database: '', user: '', password: '', ssl: false,
  });
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sqliteInputRef = useRef<HTMLInputElement>(null);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      if (dbType === 'pg') {
        if (!pg.host || !pg.database || !pg.user) {
          setError('请填写主机、数据库名和用户名');
          return;
        }
        const res = await request<{ tables: PgTable[] }>('/api/import/db-query', {
          method: 'POST',
          body: { type: 'pg', action: 'list_tables', ...pg, port: Number(pg.port) },
        });
        onLoad(res.tables, 'pg');
      } else {
        if (!sqliteFile) { setError('请选择 SQLite 文件'); return; }
        const arrayBuffer = await sqliteFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const base64 = btoa(binary);
        const res = await request<{ tables: string[] }>('/api/import/db-query', {
          method: 'POST',
          body: { type: 'sqlite', action: 'list_tables', fileBase64: base64 },
        });
        onLoad(res.tables, 'sqlite', base64);
      }
    } catch (e: any) {
      setError(e.message ?? '连接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* DB type toggle */}
      <div className="flex gap-2">
        {(['pg', 'sqlite'] as DbType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setDbType(t); setError(null); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
              dbType === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
            )}
          >
            {t === 'pg' ? 'PostgreSQL' : 'SQLite 文件'}
          </button>
        ))}
      </div>

      {dbType === 'pg' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">主机</label>
              <input
                value={pg.host}
                onChange={(e) => setPg({ ...pg, host: e.target.value })}
                placeholder="db.example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">端口</label>
              <input
                value={pg.port}
                onChange={(e) => setPg({ ...pg, port: e.target.value })}
                placeholder="5432"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">数据库名</label>
            <input
              value={pg.database}
              onChange={(e) => setPg({ ...pg, database: e.target.value })}
              placeholder="mydb"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">用户名</label>
              <input
                value={pg.user}
                onChange={(e) => setPg({ ...pg, user: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">密码</label>
              <input
                type="password"
                value={pg.password}
                onChange={(e) => setPg({ ...pg, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pg.ssl}
              onChange={(e) => setPg({ ...pg, ssl: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            启用 SSL
          </label>
        </div>
      ) : (
        <div>
          <button
            onClick={() => sqliteInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white py-6 text-sm font-bold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <UploadIcon size={16} strokeWidth={2.5} />
            {sqliteFile ? sqliteFile.name : '点击选择 .db / .sqlite 文件'}
          </button>
          <input
            ref={sqliteInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            className="hidden"
            onChange={(e) => setSqliteFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:bg-indigo-700 shadow-sm"
      >
        {loading ? '连接中…' : '连接并获取数据表列表'}
      </button>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          <AlertTriangleIcon size={12} strokeWidth={2.5} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Step 3: Field Select ─────────────────────────────────────────────────────

function JsonPathSelectStep({
  rawJson,
  selected,
  onSelect,
}: {
  rawJson: unknown;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const paths = findArrayPaths(rawJson);
  if (paths.length === 0) {
    return (
      <p className="text-sm font-bold text-slate-400 py-4 text-center">
        未在 JSON 中找到数组数据，请确认数据源格式
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">检测到以下数组路径，请选择要导入的数据：</p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {paths.map(({ path, length }) => (
          <button
            key={path}
            onClick={() => onSelect(path)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors border',
              selected === path
                ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <span className="font-mono text-xs font-bold">{path}</span>
            <span className="text-xs font-bold opacity-60">{length} 条记录</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExcelSheetSelectStep({
  sheets,
  selected,
  onSelect,
}: {
  sheets: string[];
  selected: string | null;
  onSelect: (sheet: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">选择要导入的工作表：</p>
      <div className="flex flex-wrap gap-2">
        {sheets.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors shadow-sm',
              selected === s
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function DbTableSelectStep({
  tables,
  selected,
  onSelect,
}: {
  tables: PgTable[] | string[];
  selected: string | null;
  onSelect: (table: string, schema?: string) => void;
}) {
  const isPgTables = tables.length > 0 && typeof tables[0] === 'object';
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">选择要导入的数据表：</p>
      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
        {(tables as (PgTable | string)[]).map((t) => {
          const name = typeof t === 'string' ? t : t.name;
          const schema = typeof t === 'string' ? undefined : t.schema;
          const displayName = schema ? `${schema}.${name}` : name;
          return (
            <button
              key={displayName}
              onClick={() => onSelect(name, schema)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-bold transition-colors border',
                selected === displayName
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100',
              )}
            >
              {isPgTables && schema && (
                <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {schema}
                </span>
              )}
              {name}
            </button>
          );
        })}
        {tables.length === 0 && (
          <p className="py-4 text-center text-xs font-bold text-slate-400">没有找到数据表</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Field Mapping ────────────────────────────────────────────────────

function FieldMappingStep({
  mappings,
  onChange,
}: {
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
}) {
  const update = (i: number, patch: Partial<ColumnMapping>) =>
    onChange(mappings.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500">
        配置每个字段的目标名称和类型，取消勾选以跳过该字段
      </p>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[24px_1fr_1fr_1fr_120px] gap-2 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span />
          <span>源字段</span>
          <span>样本值</span>
          <span>新字段名</span>
          <span>类型</span>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {mappings.map((m, i) => (
            <div
              key={m.sourceKey}
              className={cn(
                'grid grid-cols-[24px_1fr_1fr_1fr_120px] items-center gap-2 px-3 py-2',
                !m.include ? 'opacity-40 grayscale' : 'bg-white hover:bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                checked={m.include}
                onChange={(e) => update(i, { include: e.target.checked })}
                className="cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              <span className="truncate font-mono text-xs font-bold text-slate-900">{m.sourceKey}</span>
              <span className="truncate text-[11px] font-semibold text-slate-500">
                {m.sampleValues.slice(0, 2).join(' · ') || '—'}
              </span>
              <input
                type="text"
                value={m.targetName}
                disabled={!m.include}
                onChange={(e) => update(i, { targetName: e.target.value })}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white disabled:cursor-not-allowed"
              />
              <select
                value={m.targetType}
                disabled={!m.include}
                onChange={(e) => update(i, { targetType: e.target.value as FieldType })}
                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 focus:bg-white disabled:cursor-not-allowed cursor-pointer"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-white text-slate-900">{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  mappings,
  rowCount,
}: {
  mappings: ColumnMapping[];
  rowCount: number;
}) {
  const included = mappings.filter((m) => m.include);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 shadow-sm">
        <AlertTriangleIcon size={18} className="text-amber-600 mt-0.5 shrink-0" strokeWidth={2.5} />
        <div className="text-sm">
          <p className="font-bold text-amber-900">覆盖导入警告</p>
          <p className="mt-1 text-xs font-bold text-amber-800/80 leading-relaxed">
            导入将清除该数据源下<strong>所有已有字段和记录</strong>，并替换为新字段定义与导入数据，此操作不可撤销。
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 space-y-3 shadow-inner">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">导入摘要</p>
        <div className="flex justify-between text-sm">
          <span className="font-bold text-slate-600">字段数量</span>
          <span className="font-black text-slate-900">{included.length} 个</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-bold text-slate-600">记录数量</span>
          <span className="font-black text-slate-900">{rowCount.toLocaleString()} 条</span>
        </div>
        <div className="border-t border-slate-200 pt-3 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {included.map((m) => (
            <span
              key={m.sourceKey}
              className="rounded-full bg-indigo-100 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700"
            >
              {m.targetName}
              <span className="ml-1 opacity-60">({FIELD_TYPE_LABELS[m.targetType]})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface ImportDataModalProps {
  open: boolean;
  onClose: () => void;
  rtId: RecordTypeId;
}

export function ImportDataModal({ open, onClose, rtId }: ImportDataModalProps) {
  const { doc, batchImportToRecordType } = useDoc();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('source_type');
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [dbType, setDbType] = useState<DbType>('pg');
  const [pgConfig, setPgConfig] = useState<PgConfig | null>(null);
  const [sqliteBase64, setSqliteBase64] = useState<string | null>(null);

  // Raw data after loading
  const [rawJson, setRawJson] = useState<unknown>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [excelMeta, setExcelMeta] = useState<{ file: File; sheets: string[]; wb?: unknown } | null>(null);

  // Field select
  const [jsonPath, setJsonPath] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [dbTables, setDbTables] = useState<PgTable[] | string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  // Field mapping
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Loading/error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rt = doc?.recordTypes[rtId];

  // ── Step sequence ───────────────────────────────────────────────────────────
  const stepsFor = (src: SourceType | null): Step[] => {
    const base: Step[] = ['source_type', 'source_config'];
    if (src === 'file') {
      // JSON/Excel need field_select; CSV doesn't
      base.push('field_select');
    } else if (src === 'http') {
      base.push('field_select');
    } else if (src === 'database') {
      base.push('field_select');
    }
    base.push('field_mapping', 'confirm');
    return base;
  };

  const steps = stepsFor(sourceType);

  const resetModal = () => {
    setStep('source_type');
    setSourceType(null);
    setRawJson(null);
    setRawRows([]);
    setExcelMeta(null);
    setJsonPath(null);
    setSelectedSheet(null);
    setDbTables([]);
    setSelectedTable(null);
    setSelectedSchema(null);
    setMappings([]);
    setError(null);
    setDbType('pg');
    setPgConfig(null);
    setSqliteBase64(null);
  };

  /** Build ColumnMapping[] from a flat rows array */
  const buildMappings = useCallback((rows: Record<string, unknown>[]): ColumnMapping[] => {
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]!);
    return keys.map((key) => ({
      sourceKey: key,
      include: true,
      targetName: key,
      targetType: 'text' as FieldType,
      sampleValues: rows.slice(0, 3).map((r) => toDisplayStr(r[key])),
    }));
  }, []);

  // ── Navigation handlers ─────────────────────────────────────────────────────

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx <= 0) { onClose(); return; }
    setStep(steps[idx - 1]!);
    setError(null);
  };

  const goToFieldMapping = (rows: Record<string, unknown>[]) => {
    const limited = rows.slice(0, 10_000);
    setRawRows(limited);
    setMappings(buildMappings(limited));
    setStep('field_mapping');
  };

  /** Called when user confirms field select and moves forward */
  const handleFieldSelectNext = async () => {
    setError(null);
    setLoading(true);
    try {
      if (sourceType === 'file' && excelMeta) {
        if (!selectedSheet) { setError('请选择工作表'); return; }
        const XLSX = await import('xlsx');
        // wb may already be cached in excelMeta, or re-parse from file
        const wb: import('xlsx').WorkBook = (excelMeta as any).wb
          ?? XLSX.read(await excelMeta.file.arrayBuffer(), { type: 'array' });
        const sheet = wb.Sheets[selectedSheet];
        if (!sheet) { setError('找不到所选工作表'); return; }
        const dataRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        });
        goToFieldMapping(dataRows.slice(0, 10_000));
      } else if (sourceType === 'file' && rawJson != null) {
        // JSON path select
        if (!jsonPath) { setError('请选择数组路径'); return; }
        const selected = getByPath(rawJson, jsonPath);
        if (!Array.isArray(selected)) { setError('所选路径不是数组'); return; }
        goToFieldMapping(selected as Record<string, unknown>[]);
      } else if (sourceType === 'http') {
        if (!jsonPath) { setError('请选择数组路径'); return; }
        const selected = getByPath(rawJson, jsonPath);
        if (!Array.isArray(selected)) { setError('所选路径不是数组'); return; }
        goToFieldMapping(selected as Record<string, unknown>[]);
      } else if (sourceType === 'database') {
        if (!selectedTable) { setError('请选择数据表'); return; }
        const dbBody =
          dbType === 'pg'
            ? {
                type: 'pg',
                action: 'query_table',
                ...pgConfig,
                schema: selectedSchema ?? 'public',
                table: selectedTable,
              }
            : {
                type: 'sqlite',
                action: 'query_table',
                fileBase64: sqliteBase64,
                table: selectedTable,
              };
        const res = await request<{ columns: string[]; rows: Record<string, unknown>[] }>(
          '/api/import/db-query',
          { method: 'POST', body: dbBody },
        );
        goToFieldMapping(res.rows);
      }
    } catch (e: any) {
      setError(e.message ?? '数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  /** Execute the import */
  const handleImport = () => {
    if (!rt) return;
    const included = mappings.filter((m) => m.include && m.targetName.trim());

    // Build new RecordTypeDef
    const newFields: Record<string, FieldDef> = {};
    const newFieldOrder: string[] = [];
    const firstFieldId = uuid();

    for (let i = 0; i < included.length; i++) {
      const m = included[i]!;
      const fid = i === 0 ? firstFieldId : uuid();
      const colValues = rawRows.map((r) => toDisplayStr(r[m.sourceKey]));
      const optionSourceValues =
        m.targetType === 'multiSelect'
          ? colValues.flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
          : colValues;

      let fieldDef: FieldDef;
      if (m.targetType === 'select' || m.targetType === 'multiSelect') {
        const options = buildSelectOptions(optionSourceValues);
        fieldDef = { id: fid as any, name: m.targetName.trim(), type: m.targetType, options };
      } else {
        fieldDef = { id: fid as any, name: m.targetName.trim(), type: m.targetType } as FieldDef;
      }

      newFields[fid] = fieldDef;
      newFieldOrder.push(fid as any);
    }

    const newRtDef: RecordTypeDef = {
      ...rt,
      fields: newFields,
      fieldOrder: newFieldOrder as any[],
      primaryFieldId: (newFieldOrder[0] ?? rt.primaryFieldId) as any,
    };

    // Build rows indexed by new field ID
    const fieldIdBySourceKey: Record<string, string> = {};
    included.forEach((m, i) => {
      fieldIdBySourceKey[m.sourceKey] = newFieldOrder[i]!;
    });

    const importRows = rawRows.map((raw) => {
      const record: Record<string, import('@coxr/shared').FieldValue> = {};
      for (const m of included) {
        const fid = fieldIdBySourceKey[m.sourceKey];
        if (!fid) continue;
        const fieldDef = newFields[fid];
        const opts = (fieldDef as any).options as SelectOption[] | undefined;
        record[fid] = convertValue(raw[m.sourceKey], m.targetType, opts);
      }
      return record;
    });

    batchImportToRecordType(rtId, newRtDef, importRows);
    onClose();
    resetModal();
  };

  // ── Render step content ─────────────────────────────────────────────────────

  const renderContent = () => {
    switch (step) {
      case 'source_type':
        return (
          <SourceTypeStep
            value={sourceType}
            onChange={(t) => setSourceType(t)}
          />
        );

      case 'source_config':
        if (sourceType === 'file') {
          return (
            <FileConfigStep
              onLoad={(rows, hint, raw) => {
                if (hint === 'csv') {
                  // CSV is flat, skip field_select
                  goToFieldMapping(rows);
                } else if (hint === 'json') {
                  setRawJson(raw);
                  if (Array.isArray(raw)) {
                    // Root is already array, skip path select
                    setJsonPath('(root)');
                    goToFieldMapping(rows);
                  } else {
                    setStep('field_select');
                  }
                } else if (hint === 'excel') {
                  const meta = raw as { file: File; sheets: string[] };
                  setExcelMeta(meta);
                  if (meta.sheets.length === 1) {
                    // Single sheet, pre-select it but still show selector briefly? 
                    // Auto-advance if only 1 sheet
                    setSelectedSheet(meta.sheets[0]!);
                    setStep('field_select');
                  } else {
                    setStep('field_select');
                  }
                }
              }}
            />
          );
        }
        if (sourceType === 'http') {
          return (
            <HttpConfigStep
              onLoad={(rows, raw) => {
                setRawJson(raw);
                if (Array.isArray(raw)) {
                  setJsonPath('(root)');
                  goToFieldMapping(rows);
                } else {
                  setStep('field_select');
                }
              }}
            />
          );
        }
        if (sourceType === 'database') {
          return (
            <DbConfigStep
              onLoad={(tables, dt, base64) => {
                setDbType(dt);
                setDbTables(tables);
                if (base64) setSqliteBase64(base64);
                setStep('field_select');
              }}
            />
          );
        }
        return null;

      case 'field_select':
        if (sourceType === 'database') {
          return (
            <DbTableSelectStep
              tables={dbTables}
              selected={
                selectedTable
                  ? selectedSchema
                    ? `${selectedSchema}.${selectedTable}`
                    : selectedTable
                  : null
              }
              onSelect={(t, s) => { setSelectedTable(t); setSelectedSchema(s ?? null); }}
            />
          );
        }
        if (sourceType === 'file' && excelMeta) {
          return (
            <ExcelSheetSelectStep
              sheets={excelMeta.sheets}
              selected={selectedSheet}
              onSelect={setSelectedSheet}
            />
          );
        }
        // JSON or HTTP — show path selector
        return (
          <JsonPathSelectStep
            rawJson={rawJson}
            selected={jsonPath}
            onSelect={setJsonPath}
          />
        );

      case 'field_mapping':
        return <FieldMappingStep mappings={mappings} onChange={setMappings} />;

      case 'confirm':
        return <ConfirmStep mappings={mappings} rowCount={rawRows.length} />;
    }
  };

  // ── Footer button logic ─────────────────────────────────────────────────────

  const getNextLabel = () => {
    if (step === 'confirm') return '开始导入';
    return '下一步';
  };

  const isNextDisabled = () => {
    if (step === 'source_type') return !sourceType;
    if (step === 'field_select') {
      if (sourceType === 'database') return !selectedTable;
      if (sourceType === 'file' && excelMeta) return !selectedSheet;
      return !jsonPath;
    }
    if (step === 'field_mapping') return mappings.filter((m) => m.include).length === 0;
    return false;
  };

  const handleNext = () => {
    setError(null);
    const idx = steps.indexOf(step);

    if (step === 'source_type') {
      setStep('source_config');
      return;
    }
    if (step === 'field_select') {
      handleFieldSelectNext();
      return;
    }
    if (step === 'field_mapping') {
      setStep('confirm');
      return;
    }
    if (step === 'confirm') {
      handleImport();
      return;
    }
    // Fallback
    if (idx < steps.length - 1) setStep(steps[idx + 1]!);
  };

  // source_config step has its own "next" logic embedded in each sub-component,
  // so the footer Next button is hidden on that step.
  const showFooterNext = step !== 'source_config';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) { onClose(); resetModal(); }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden',
            'rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5">
            <div>
              <Dialog.Title className="text-base font-bold text-slate-900">
                导入数据到「{rt?.name ?? '数据源'}」
              </Dialog.Title>
              <div className="mt-2.5">
                <StepIndicator current={step} steps={steps} />
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <XIcon size={18} strokeWidth={2.5} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-6 min-h-[300px]">
            {renderContent()}
            {error && (
              <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600">
                <AlertTriangleIcon size={14} strokeWidth={2.5} /> {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <ChevronLeftIcon size={16} strokeWidth={2.5} />
              {steps.indexOf(step) === 0 ? '取消' : '上一步'}
            </button>

            {showFooterNext && (
              <button
                onClick={handleNext}
                disabled={isNextDisabled() || loading}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-6 py-2 text-sm font-bold transition-all shadow-sm',
                  step === 'confirm'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40'
                    : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40',
                )}
              >
                {loading ? '加载中…' : getNextLabel()}
                {!loading && step !== 'confirm' && <ChevronRightIcon size={16} strokeWidth={2.5} />}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
