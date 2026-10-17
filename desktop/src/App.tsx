import { useEffect, useMemo, useState } from 'react';

type Template = { id: string; category: string; diagnosis: string; complaints: string; anamnesis: string; examination: string; treatment: string };
const STORAGE_KEY = 'smp-card-assistant.templates.v1';
const starter: Template[] = [
  { id: 'hypertension', category: 'Кардиология', diagnosis: 'Гипертонический криз', complaints: '', anamnesis: '', examination: '', treatment: '' },
  { id: 'stroke', category: 'Неврология', diagnosis: 'Острое нарушение мозгового кровообращения', complaints: '', anamnesis: '', examination: '', treatment: '' },
  { id: 'diabetes1', category: 'Эндокринология', diagnosis: 'Сахарный диабет 1-го типа', complaints: '', anamnesis: '', examination: '', treatment: '' },
  { id: 'diabetes2', category: 'Эндокринология', diagnosis: 'Сахарный диабет 2-го типа', complaints: '', anamnesis: '', examination: '', treatment: '' },
];
const blank = (): Template => ({ id: crypto.randomUUID(), category: 'Терапия', diagnosis: 'Новый шаблон', complaints: '', anamnesis: '', examination: '', treatment: '' });

function loadTemplates(): Template[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return starter;
    const data = JSON.parse(saved);
    if (!Array.isArray(data) || !data.every(t => t && typeof t.id === 'string' && typeof t.category === 'string' && typeof t.diagnosis === 'string')) return starter;
    return data.map((t: Partial<Template>) => ({
      id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
      category: typeof t.category === 'string' ? t.category : 'Терапия',
      diagnosis: typeof t.diagnosis === 'string' ? t.diagnosis : 'Новый шаблон',
      complaints: typeof t.complaints === 'string' ? t.complaints : '',
      anamnesis: typeof t.anamnesis === 'string' ? t.anamnesis : '',
      examination: typeof t.examination === 'string' ? t.examination : '',
      treatment: typeof t.treatment === 'string' ? t.treatment : '',
    }));
  } catch {
    return starter;
  }
}

export default function App() {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [selectedId, setSelectedId] = useState(() => loadTemplates()[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Автосохранение включено.');
  const selected = templates.find(t => t.id === selectedId) ?? templates[0];
  const filtered = useMemo(() => templates.filter(t => `${t.category} ${t.diagnosis}`.toLowerCase().includes(search.toLowerCase())), [templates, search]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      setStatus('Не удалось сохранить шаблоны автоматически. Используйте экспорт JSON.');
    }
  }, [templates]);

  const update = (key: keyof Template, value: string) => {
    setTemplates(current => current.map(t => t.id === selectedId ? { ...t, [key]: value } : t));
    setStatus('Изменения сохраняются автоматически.');
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, templates }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smp-templates.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('JSON-файл шаблонов экспортирован.');
  };
  const importJson = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const incoming = Array.isArray(data) ? data : data.templates;
        if (!Array.isArray(incoming) || !incoming.every(t => t && typeof t.category === 'string' && typeof t.diagnosis === 'string')) throw new Error('bad format');
        const normalized: Template[] = incoming.map((t: Partial<Template>) => ({
          id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
          category: t.category ?? 'Терапия',
          diagnosis: t.diagnosis ?? 'Новый шаблон',
          complaints: t.complaints ?? '',
          anamnesis: t.anamnesis ?? '',
          examination: t.examination ?? '',
          treatment: t.treatment ?? '',
        }));
        setTemplates(normalized);
        setSelectedId(normalized[0]?.id ?? '');
        setStatus(`Импортировано шаблонов: ${normalized.length}. Изменения сохранятся автоматически.`);
      } catch {
        setStatus('Не удалось прочитать файл. Проверьте формат JSON.');
      }
    };
    reader.readAsText(file);
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">СМП</div><div><h1>SMP Card Assistant</h1><p>Редактор шаблонов карт вызова</p></div><div className="top-spacer"/><button className="primary" onClick={exportJson}>Экспорт JSON</button><label className="button secondary">Импорт JSON<input type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])}/></label></header>
    <div className="workspace"><aside className="sidebar"><div className="side-heading"><h2>Шаблоны</h2><button title="Добавить шаблон" onClick={() => { const t = blank(); setTemplates(v => [...v, t]); setSelectedId(t.id); setStatus('Новый шаблон добавлен.'); }}>＋</button></div><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск диагноза…"/><div className="template-list">{filtered.map(t => <button key={t.id} className={`template-item ${selectedId === t.id ? 'active' : ''}`} onClick={() => setSelectedId(t.id)}><span>{t.category}</span><strong>{t.diagnosis}</strong></button>)}</div><p className="sidebar-note">Шаблон не является готовым медицинским заключением. Перед использованием проверьте каждое поле.</p></aside>
    {selected ? <section className="editor"><div className="page-heading"><div><span className="eyebrow">РЕДАКТОР ШАБЛОНА</span><h2>{selected.diagnosis}</h2></div><button className="danger-ghost" onClick={() => { if (templates.length < 2) { setStatus('Нужен хотя бы один шаблон.'); return; } const next = templates.filter(t => t.id !== selectedId); setTemplates(next); setSelectedId(next[0].id); setStatus('Шаблон удалён.'); }}>Удалить шаблон</button></div>
      <div className="field-grid"><label className="field"><span>Категория</span><input value={selected.category} onChange={e => update('category', e.target.value)} placeholder="Например, Кардиология"/></label><label className="field"><span>Название диагноза</span><input value={selected.diagnosis} onChange={e => update('diagnosis', e.target.value)}/></label></div>
      <div className="section-title"><h3>Текстовые заготовки</h3><p>Заполняйте только проверенные формулировки. Фактические показатели и назначения подтверждаются для каждого вызова отдельно.</p></div>
      <label className="field"><span>Жалобы</span><textarea value={selected.complaints} onChange={e => update('complaints', e.target.value)} placeholder="Заготовка текста жалоб…" rows={3}/></label>
      <label className="field"><span>Анамнез заболевания</span><textarea value={selected.anamnesis} onChange={e => update('anamnesis', e.target.value)} placeholder="Заготовка анамнеза…" rows={3}/></label>
      <label className="field"><span>Объективный осмотр</span><textarea value={selected.examination} onChange={e => update('examination', e.target.value)} placeholder="Заготовка осмотра…" rows={4}/></label>
      <label className="field"><span>Лечение и рекомендации</span><textarea value={selected.treatment} onChange={e => update('treatment', e.target.value)} placeholder="Текст лечения и рекомендаций…" rows={3}/></label>
      <div className="notice"><span className="notice-icon">i</span><p>Шаблоны сохраняются на этом компьютере автоматически. Экспорт JSON полезен для резервной копии и переноса на другой компьютер. Автоматическое заполнение и сохранение карты в Промед не выполняется.</p></div>
      <footer className="statusbar"><span className="status-dot"/>{status}<span className="status-spacer"/><span>{templates.length} шабл.</span></footer>
    </section> : <section className="editor empty-state">Добавьте шаблон, чтобы начать.</section>}</div>
  </main>;
}
