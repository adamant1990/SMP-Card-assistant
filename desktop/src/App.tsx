import { useEffect, useMemo, useState } from 'react';

type ExtensionValue = string | boolean | string[];
type EditableTextKey = 'category' | 'diagnosis' | 'complaints' | 'anamnesis' | 'examination' | 'treatment';
type Template = {
  id: string; category: string; diagnosis: string;
  complaints: string; anamnesis: string; examination: string; treatment: string;
  extensionFields: Record<string, ExtensionValue>;
};
type FieldDef = {
  id: string; label: string; kind?: 'text' | 'textarea' | 'select' | 'check' | 'multi';
  hint?: string; options?: string[];
};
type SectionDef = { title: string; fields: FieldDef[] };

const STORAGE_KEY = 'smp-card-assistant.templates.v1';
const starter: Template[] = [
  { id: 'hypertension', category: 'Кардиология', diagnosis: 'Гипертонический криз', complaints: '', anamnesis: '', examination: '', treatment: '', extensionFields: {} },
  { id: 'stroke', category: 'Неврология', diagnosis: 'Острое нарушение мозгового кровообращения', complaints: '', anamnesis: '', examination: '', treatment: '', extensionFields: {} },
  { id: 'diabetes1', category: 'Эндокринология', diagnosis: 'Сахарный диабет 1-го типа', complaints: '', anamnesis: '', examination: '', treatment: '', extensionFields: {} },
  { id: 'diabetes2', category: 'Эндокринология', diagnosis: 'Сахарный диабет 2-го типа', complaints: '', anamnesis: '', examination: '', treatment: '', extensionFields: {} },
];
const blank = (): Template => ({ id: crypto.randomUUID(), category: 'Терапия', diagnosis: 'Новый шаблон', complaints: '', anamnesis: '', examination: '', treatment: '', extensionFields: {} });

const unchanged = ['Не менять', 'unchanged'];
const yesNo = [{ value: 'unchanged', label: 'Не менять' }, { value: 'yes', label: 'Да / Есть' }, { value: 'no', label: 'Нет' }];
const sections: SectionDef[] = [
  { title: 'Причина вызова и сведения о пациенте', fields: [
    { id: 'reason', label: 'Причина обращения', kind: 'select', options: ['unchanged','Несчастный случай','Острое внезапное заболевание','Роды (вне МО)','Обострение хронического заболевания','Патология беременности','Медицинская эвакуация экстренная','Дежурство при угрозе ЧС','Дежурство на мероприятии','Другое','Плановая перевозка','Платная мед.услуга'] },
    { id: 'epidemic', label: 'Эпидемиологический анамнез', kind: 'textarea' },
    { id: 'allergy', label: 'Аллергия', kind: 'select', options: yesNo.map(x => x.value) , hint: 'Значения: unchanged, no, yes' },
    { id: 'foreignTrip', label: 'Выезд за пределы территории', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'villageTrip', label: 'Выезд в село', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'infectionContact', label: 'Контакт с инфекционными больными', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'lowQualityProducts', label: 'Употребление некачественных продуктов', kind: 'select', options: ['unchanged','Нет','Да'] },
    { id: 'callTeamPlace', label: 'Место получения вызова', kind: 'select', options: ['unchanged','Станция (подстанция, отделение)','По телефону','По рации'] },
    { id: 'residentType', label: 'Регистрация пациента', kind: 'select', options: ['unchanged','житель города','житель сельской местности','приезжий'] },
    { id: 'socialStatus', label: 'Социальное положение', kind: 'select', options: ['unchanged','Работающий','Дошкольник','Учащийся','Безработный','Временно не работающий','Пенсионер'] },
    { id: 'execution', label: 'Исполнение', kind: 'select', options: ['unchanged','Вызов исполнен'] },
    { id: 'traumaType', label: 'Тип травмы', kind: 'select', options: ['unchanged','Бытовая'] },
    { id: 'alcoholIntoxication', label: 'Наличие опьянения', kind: 'select', options: ['unchanged','Да','Нет'] },
    { id: 'deliveryPersonType', label: 'Доставка больного в автомобиль', kind: 'select', options: ['unchanged','Перенесен на носилках','Перенесен на других подручных средствах','Передвигался самостоятельно','На руках'] },
    { id: 'callNote', label: 'Примечание', kind: 'textarea' },
    { id: 'arrivalMileage', label: 'Километраж доезда', kind: 'text' },
    { id: 'totalMileage', label: 'Общий километраж', kind: 'text' },
  ]},
  { title: 'Общее состояние и кожные покровы', fields: [
    { id: 'generalCondition', label: 'Общее состояние', kind: 'select', options: ['unchanged','Удовлетворительное','Средней степени тяжести','Тяжёлое','Агональное','Клиническая смерть','Биологическая смерть'] },
    { id: 'behavior', label: 'Поведение', kind: 'select', options: ['unchanged','Спокойное','Возбуждённое','Агрессивное','Депрессивное','Эмоционально лабилен'] },
    { id: 'bodyPosition', label: 'Положение тела', kind: 'select', options: ['unchanged','Активное','Пассивное','Вынужденное'] },
    { id: 'visibleDamage', label: 'Видимые повреждения', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'visibleDamageExtra', label: 'Описание видимых повреждений', kind: 'textarea' },
    { id: 'skinCondition', label: 'Кожные покровы: описание', kind: 'text' },
    { id: 'skinPale', label: 'Бледные', kind: 'check' },
    { id: 'skinHyperemic', label: 'Гиперемированные', kind: 'check' },
    { id: 'skinJaundiced', label: 'Желтушные', kind: 'check' },
    { id: 'skinNormal', label: 'Нормальные', kind: 'check' },
    { id: 'skinDry', label: 'Сухие', kind: 'check' },
    { id: 'skinMoist', label: 'Влажные', kind: 'check' },
    { id: 'acrocyanosis', label: 'Акроцианоз', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'marbling', label: 'Мраморность кожи', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'edema', label: 'Отёки', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'edemaExtra', label: 'Описание / локализация отёков', kind: 'textarea' },
    { id: 'rash', label: 'Сыпь', kind: 'select', options: ['unchanged','Есть','Нет'] },
    { id: 'rashExtra', label: 'Описание сыпи', kind: 'textarea' },
  ]},
  { title: 'Неврологический статус', fields: [
    { id: 'consciousness', label: 'Сознание', kind: 'select', options: ['unchanged','Ясное','Спутанное','Заторможенное','Отсутствует (коматозное)'] },
    { id: 'meningeal', label: 'Менингеальные знаки', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'pupils', label: 'Зрачки', kind: 'select', options: ['unchanged','Нормальные','Широкие','Узкие'] },
    { id: 'nystagmus', label: 'Нистагм', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'anisocoria', label: 'Анизокория', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'lightReaction', label: 'Реакция зрачков на свет', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'fontanelle', label: 'Большой родничок напряжён', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'cornealReflexes', label: 'Корнеальные рефлексы', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'beloglazov', label: 'Симптом Белоглазова', kind: 'select', options: ['unchanged','Положительный','Отрицательный'] },
  ]},
  { title: 'Дыхание, сердце и живот', fields: [
    { id: 'urination', label: 'Мочеиспускание', kind: 'text' },
    { id: 'stool', label: 'Стул', kind: 'text' },
    { id: 'otherSymptoms', label: 'Другие симптомы', kind: 'textarea' },
    { id: 'localStatus', label: 'Локальный статус', kind: 'textarea' },
    { id: 'throat', label: 'Зев', kind: 'text' },
    { id: 'breath', label: 'Дыхание', kind: 'select', options: ['unchanged','Везикулярное','Жесткое','Ослабленное','Бронхиальное','Отсутствует'] },
    { id: 'rattle', label: 'Хрипы', kind: 'select', options: ['unchanged','Сухие','Влажные','Нет'] },
    { id: 'rattleExtra', label: 'Описание хрипов', kind: 'text' },
    { id: 'dyspnea', label: 'Одышка', kind: 'select', options: ['unchanged','Инспираторная','Экспираторная','Смешанная'] },
    { id: 'percussion', label: 'Перкуторно', kind: 'text' },
    { id: 'heartRhythm', label: 'Ритмичность тонов сердца', kind: 'select', options: ['unchanged','Ритмичные','Аритмичные'] },
    { id: 'heartSound', label: 'Звучность тонов сердца', kind: 'select', options: ['unchanged','Ясные','Глухие','Приглушённые','Отсутствуют'] },
    { id: 'heartNoise', label: 'Шумы сердца', kind: 'multi', options: ['Систолические','Диастолические','Трение перикарда'] },
    { id: 'pulse', label: 'Пульс: характеристика', kind: 'multi', options: ['Нормальный','Ритмичный','Аритмичный','Напряженный','Слабого наполнения','Нитевидный','Отсутствует'] },
    { id: 'tongueMoisture', label: 'Влажность языка', kind: 'select', options: ['unchanged','Влажный','Сухой'] },
    { id: 'tongueCoating', label: 'Состояние языка', kind: 'select', options: ['unchanged','Чистый','Обложен'] },
    { id: 'abdomenTexture', label: 'Характеристика живота', kind: 'select', options: ['unchanged','Мягкий','Напряжённый'] },
    { id: 'abdomenTenderness', label: 'Болезненность живота', kind: 'select', options: ['unchanged','Безболезненный','Болезненный'] },
    { id: 'abdominalPainLocation', label: 'Локализация болей в животе', kind: 'text' },
    { id: 'liverSize', label: 'Печень', kind: 'select', options: ['unchanged','Увеличена','Не увеличена'] },
    { id: 'abdomenBreath', label: 'Участвует в акте дыхания', kind: 'select', options: ['unchanged','Да','Нет'] },
    { id: 'peritoneal', label: 'Симптомы раздражения брюшины', kind: 'select', options: ['unchanged','Да','Нет'] },
  ]},
  { title: 'Жизненные показатели до оказания помощи', fields: [
    { id: 'workingSystolic', label: 'Рабочее АД: систолическое', kind: 'text' },
    { id: 'workingDiastolic', label: 'Рабочее АД: диастолическое', kind: 'text' },
    { id: 'systolic', label: 'АД: систолическое', kind: 'text' },
    { id: 'diastolic', label: 'АД: диастолическое', kind: 'text' },
    { id: 'pulseRate', label: 'Пульс, уд/мин', kind: 'text' },
    { id: 'heartRate', label: 'ЧСС, уд/мин', kind: 'text' },
    { id: 'breathingRate', label: 'ЧДД, в мин', kind: 'text' },
    { id: 'temperature', label: 'Температура, °C', kind: 'text' },
    { id: 'pulseOximetry', label: 'SpO₂, %', kind: 'text' },
    { id: 'glucometry', label: 'Глюкометрия', kind: 'text' },
  ]},
  { title: 'Оказанная помощь и показатели после неё', fields: [
    { id: 'helpOnCallPlace', label: 'Оказанная помощь на месте вызова', kind: 'textarea' },
    { id: 'helpInEmergencyCar', label: 'Оказанная помощь в автомобиле СМП', kind: 'textarea' },
    { id: 'afterSystolic', label: 'АД после помощи: систолическое', kind: 'text' },
    { id: 'afterDiastolic', label: 'АД после помощи: диастолическое', kind: 'text' },
    { id: 'afterPulse', label: 'Пульс после помощи', kind: 'text' },
    { id: 'afterHeartRate', label: 'ЧСС после помощи', kind: 'text' },
    { id: 'afterBreathingRate', label: 'ЧДД после помощи', kind: 'text' },
    { id: 'afterTemperature', label: 'Температура после помощи', kind: 'text' },
    { id: 'afterPulseOximetry', label: 'SpO₂ после помощи', kind: 'text' },
    { id: 'afterGlucometry', label: 'Глюкометрия после помощи', kind: 'text' },
  ]},
  { title: 'Манипуляции', fields: [
    { id: 'procIV', label: 'Внутривенное введение лекарственных препаратов', kind: 'check' },
    { id: 'procIM', label: 'Внутримышечное введение лекарственных препаратов', kind: 'check' },
    { id: 'procNasalPacking', label: 'Задняя тампонада носа', kind: 'check' },
    { id: 'procGlucose', label: 'Измерение глюкозы', kind: 'check' },
    { id: 'procVeinCatheter', label: 'Катетеризация периферических вен', kind: 'check' },
    { id: 'procSplint', label: 'Наложение шины при переломах костей', kind: 'check' },
    { id: 'procParamedicExam', label: 'Осмотр фельдшером скорой медицинской помощи', kind: 'check' },
    { id: 'procPulseOx', label: 'Пульсоксиметрия', kind: 'check' },
    { id: 'procECG', label: 'Регистрация электрокардиограммы', kind: 'check' },
    { id: 'procECGInterpretation', label: 'Расшифровка ЭКГ', kind: 'check' },
  ]},
  { title: 'Исход и рекомендации', fields: [
    { id: 'isKupir', label: 'Купированы боли / приступы', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'medicalIntervention', label: 'Медицинское вмешательство', kind: 'select', options: ['unchanged','Согласие','Отказ'] },
    { id: 'transportConsent', label: 'Транспортировка в стационар', kind: 'select', options: ['unchanged','Согласие','Отказ'] },
    { id: 'careResult', label: 'Результат оказания СМП', kind: 'select', options: ['unchanged','Улучшение','Без эффекта','Ухудшение'] },
    { id: 'aftercareRecommendation', label: 'Рекомендация пациенту', kind: 'select', options: ['unchanged','Рекомендуется обратиться в поликлинику'] },
  ]},
];

function normalizeTemplate(t: Partial<Template>, index: number): Template {
  const rawFields = t.extensionFields && typeof t.extensionFields === 'object' ? t.extensionFields : {};
  const extensionFields: Record<string, ExtensionValue> = {};
  Object.entries(rawFields).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'boolean' || (Array.isArray(value) && value.every(v => typeof v === 'string'))) {
      extensionFields[key] = value as ExtensionValue;
    }
  });
  return {
    id: typeof t.id === 'string' ? t.id : 'imported-' + index + '-' + crypto.randomUUID(),
    category: typeof t.category === 'string' ? t.category : 'Терапия',
    diagnosis: typeof t.diagnosis === 'string' ? t.diagnosis : 'Новый шаблон',
    complaints: typeof t.complaints === 'string' ? t.complaints : '',
    anamnesis: typeof t.anamnesis === 'string' ? t.anamnesis : '',
    examination: typeof t.examination === 'string' ? t.examination : '',
    treatment: typeof t.treatment === 'string' ? t.treatment : '',
    extensionFields,
  };
}
function loadTemplates(): Template[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return starter;
    const data = JSON.parse(saved);
    const incoming = Array.isArray(data) ? data : data.templates;
    if (!Array.isArray(incoming) || !incoming.every(t => t && typeof t.category === 'string' && typeof t.diagnosis === 'string')) return starter;
    return incoming.map((t: Partial<Template>, i: number) => normalizeTemplate(t, i));
  } catch { return starter; }
}

export default function App() {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [selectedId, setSelectedId] = useState(() => loadTemplates()[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Автосохранение включено.');
  const selected = templates.find(t => t.id === selectedId) ?? templates[0];
  const filtered = useMemo(() => templates.filter(t => (t.category + ' ' + t.diagnosis).toLowerCase().includes(search.toLowerCase())), [templates, search]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); }
    catch { setStatus('Не удалось сохранить шаблоны автоматически. Используйте экспорт JSON.'); }
  }, [templates]);

  const update = (key: EditableTextKey, value: string) => {
    setTemplates(current => current.map(t => t.id === selectedId ? { ...t, [key]: value } : t));
    setStatus('Изменения сохраняются автоматически.');
  };
  const updateExtensionField = (key: string, value: ExtensionValue) => {
    setTemplates(current => current.map(t => t.id === selectedId ? { ...t, extensionFields: { ...t.extensionFields, [key]: value } } : t));
    setStatus('Изменения сохраняются автоматически.');
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 2, templates }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'smp-templates.json'; a.click();
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
        const normalized = incoming.map((t: Partial<Template>, i: number) => normalizeTemplate(t, i));
        setTemplates(normalized); setSelectedId(normalized[0]?.id ?? '');
        setStatus('Импортировано шаблонов: ' + normalized.length + '. Изменения сохранятся автоматически.');
      } catch { setStatus('Не удалось прочитать файл. Проверьте формат JSON.'); }
    };
    reader.readAsText(file);
  };
  const updateSelected = (key: EditableTextKey, value: string) => update(key, value);
  const getFieldValue = (field: FieldDef): ExtensionValue => {
    const value = selected?.extensionFields[field.id];
    if (value !== undefined) return value;
    if (field.kind === 'check') return false;
    if (field.kind === 'multi') return [];
    return field.kind === 'select' ? 'unchanged' : '';
  };
  const renderField = (field: FieldDef) => {
    const value = getFieldValue(field);
    if (field.kind === 'check') return <label className="check-field" key={field.id}><input type="checkbox" checked={Boolean(value)} onChange={e => updateExtensionField(field.id, e.target.checked)} /><span>{field.label}</span></label>;
    if (field.kind === 'multi') return <div className="field multi-field" key={field.id}><span>{field.label}</span><div className="multi-options">{(field.options || []).map(option => <label key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => { const old = Array.isArray(value) ? value : []; updateExtensionField(field.id, e.target.checked ? [...old, option] : old.filter(x => x !== option)); }} />{option}</label>)}</div></div>;
    if (field.kind === 'select') return <label className="field" key={field.id}><span>{field.label}</span><select value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)}>{(field.options || unchanged).map(option => <option key={option} value={option}>{option === 'unchanged' ? 'Не менять' : option === 'yes' ? 'Да / Есть' : option === 'no' ? 'Нет' : option}</option>)}</select>{field.hint ? <small>{field.hint}</small> : null}</label>;
    if (field.kind === 'textarea') return <label className="field" key={field.id}><span>{field.label}</span><textarea rows={2} value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)} placeholder="Оставь пустым, если менять не нужно" /></label>;
    return <label className="field" key={field.id}><span>{field.label}</span><input value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)} placeholder="Оставь пустым, если менять не нужно" /></label>;
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">СМП</div><div><h1>SMP Card Assistant</h1><p>Редактор шаблонов карт вызова</p></div><div className="top-spacer"/><button className="primary" onClick={exportJson}>Экспорт JSON</button><label className="button secondary">Импорт JSON<input type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])}/></label></header>
    <div className="workspace"><aside className="sidebar"><div className="side-heading"><h2>Шаблоны</h2><button title="Добавить шаблон" onClick={() => { const t = blank(); setTemplates(v => [...v, t]); setSelectedId(t.id); setStatus('Новый шаблон добавлен.'); }}>＋</button></div><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск диагноза…"/><div className="template-list">{filtered.map(t => <button key={t.id} className={'template-item ' + (selectedId === t.id ? 'active' : '')} onClick={() => setSelectedId(t.id)}><span>{t.category}</span><strong>{t.diagnosis}</strong></button>)}</div><p className="sidebar-note">Шаблон не является готовым медицинским заключением. Перед использованием проверь каждое поле.</p></aside>
    {selected ? <section className="editor"><div className="page-heading"><div><span className="eyebrow">РЕДАКТОР ШАБЛОНА</span><h2>{selected.diagnosis}</h2></div><button className="danger-ghost" onClick={() => { if (templates.length < 2) { setStatus('Нужен хотя бы один шаблон.'); return; } const next = templates.filter(t => t.id !== selectedId); setTemplates(next); setSelectedId(next[0].id); setStatus('Шаблон удалён.'); }}>Удалить шаблон</button></div>
      <div className="field-grid"><label className="field"><span>Категория</span><input value={selected.category} onChange={e => updateSelected('category', e.target.value)} placeholder="Например, Кардиология"/></label><label className="field"><span>Название диагноза</span><input value={selected.diagnosis} onChange={e => updateSelected('diagnosis', e.target.value)}/></label></div>
      <div className="section-title"><h3>Текстовые заготовки</h3><p>Фактические показатели и назначения подтверждаются для каждого вызова отдельно.</p></div>
      <label className="field"><span>Жалобы</span><textarea value={selected.complaints} onChange={e => updateSelected('complaints', e.target.value)} placeholder="Заготовка текста жалоб…" rows={3}/></label>
      <label className="field"><span>Анамнез заболевания</span><textarea value={selected.anamnesis} onChange={e => updateSelected('anamnesis', e.target.value)} placeholder="Заготовка анамнеза…" rows={3}/></label>
      <label className="field"><span>Объективный осмотр (общая заготовка)</span><textarea value={selected.examination} onChange={e => updateSelected('examination', e.target.value)} placeholder="Общая заготовка осмотра; ниже доступны отдельные поля ProMed…" rows={3}/></label>
      <label className="field"><span>Лечение и рекомендации (текстовая заготовка)</span><textarea value={selected.treatment} onChange={e => updateSelected('treatment', e.target.value)} placeholder="Текстовая заготовка лечения и рекомендаций…" rows={3}/></label>
      <div className="section-title"><h3>Поля карты ProMed</h3><p>Выбери нужные значения в шаблоне. «Не менять» оставляет текущее значение в карте. Числовые поля оставляй пустыми, если значение должно вводиться по факту вызова.</p></div>
      {sections.map((section, index) => <details className="section-card" key={section.title} open={index === 0}><summary>{section.title}<span>{section.fields.length} полей</span></summary><div className="section-fields">{section.fields.map(renderField)}</div></details>)}
      <div className="notice"><span className="notice-icon">i</span><p>Шаблоны хранятся локально на этом компьютере. Экспортируй JSON и импортируй его в расширение Chrome. Проверь каждое заполненное поле в ProMed и сохраняй карту вручную. Автосохранение карты отключено.</p></div>
      <footer className="statusbar"><span className="status-dot"/>{status}<span className="status-spacer"/><span>{templates.length} шабл.</span></footer>
    </section> : <section className="editor empty-state">Добавьте шаблон, чтобы начать.</section>}</div>
  </main>;
}
