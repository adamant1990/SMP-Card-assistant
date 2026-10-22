import { useEffect, useMemo, useState } from 'react';

type ExtensionValue = string | boolean | string[];
type EditableTextKey = 'category' | 'diagnosis' | 'diagnosisCode' | 'complaints' | 'anamnesis';
type Template = {
  id: string; category: string; diagnosis: string; diagnosisCode?: string;
  complaints: string; anamnesis: string;
  extensionFields: Record<string, ExtensionValue>;
};
type FieldDef = {
  id: string; label: string; kind?: 'text' | 'textarea' | 'select' | 'check' | 'multi';
  hint?: string; options?: string[];
};
type SectionDef = { title: string; fields: FieldDef[] };

const STORAGE_KEY = 'smp-card-assistant.templates.v1';
const starter: Template[] = [
  { id: 'hypertension', category: 'Кардиология', diagnosis: 'Гипертонический криз', complaints: '', anamnesis: '', extensionFields: {} },
  { id: 'stroke', category: 'Неврология', diagnosis: 'Острое нарушение мозгового кровообращения', complaints: '', anamnesis: '', extensionFields: {} },
  { id: 'diabetes1', category: 'Эндокринология', diagnosis: 'Сахарный диабет 1-го типа', complaints: '', anamnesis: '', extensionFields: {} },
  { id: 'diabetes2', category: 'Эндокринология', diagnosis: 'Сахарный диабет 2-го типа', complaints: '', anamnesis: '', extensionFields: {} },
];
const blank = (): Template => ({ id: crypto.randomUUID(), category: 'Терапия', diagnosis: 'Новый шаблон', complaints: '', anamnesis: '', extensionFields: {} });

const unchanged = ['Не менять', 'unchanged'];
const yesNo = [{ value: 'unchanged', label: 'Не менять' }, { value: 'yes', label: 'Да / Есть' }, { value: 'no', label: 'Нет' }];
const sections: SectionDef[] = [
  { title: 'Регистрация и сведения о вызове', fields: [
    { id: 'residentType', label: 'Регистрация пациента', kind: 'select', options: ['unchanged','житель города','житель сельской местности','приезжий'] },
    { id: 'socialStatus', label: 'Социальное положение', kind: 'select', options: ['unchanged','Работающий','Дошкольник','Учащийся','Безработный','Временно не работающий','Пенсионер'] },
    { id: 'reason', label: 'Причина обращения', kind: 'select', options: ['unchanged','Несчастный случай','Острое внезапное заболевание','Роды (вне МО)','Обострение хронического заболевания','Патология беременности','Медицинская эвакуация экстренная','Дежурство при угрозе ЧС','Дежурство на мероприятии','Другое','Плановая перевозка','Платная мед.услуга'] },
    { id: 'execution', label: 'Исполнение', kind: 'select', options: ['unchanged','Вызов исполнен'] },
    { id: 'traumaType', label: 'Травма', kind: 'select', options: ['unchanged','Бытовая'] },
    { id: 'alcoholIntoxication', label: 'Наличие клиники опьянения', kind: 'select', options: ['unchanged','Да','Нет'] },
    { id: 'callTeamPlace', label: 'Место получения вызова', kind: 'select', options: ['unchanged','Станция (подстанция, отделение)','По телефону','По рации'] },
  ]},
  { title: 'Анамнез и эпидемиологические сведения', fields: [
    { id: 'allergy', label: 'Аллергия', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'epidemic', label: 'Эпидемиологический анамнез', kind: 'textarea' },
    { id: 'foreignTrip', label: 'Выезд за пределы РФ', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'villageTrip', label: 'Выезд в сельскую местность', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'infectionContact', label: 'Контакт с инфекционными больными, животными, грызунами', kind: 'select', options: yesNo.map(x => x.value), hint: 'Значения: unchanged, no, yes' },
    { id: 'lowQualityProducts', label: 'Употребление некачественных продуктов', kind: 'select', options: ['unchanged','Нет','Да'] },
  ]},
  { title: 'Общее состояние и неврологический статус', fields: [
    { id: 'generalCondition', label: 'Общее состояние', kind: 'select', options: ['unchanged','Удовлетворительное','Средней степени тяжести','Тяжёлое','Агональное','Клиническая смерть','Биологическая смерть'] },
    { id: 'behavior', label: 'Поведение', kind: 'select', options: ['unchanged','Спокойное','Возбуждённое','Агрессивное','Депрессивное','Эмоционально лабилен'] },
    { id: 'bodyPosition', label: 'Положение тела', kind: 'select', options: ['unchanged','Активное','Пассивное','Вынужденное'] },
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
  { title: 'Кожные покровы и повреждения', fields: [
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
    { id: 'marbling', label: 'Мраморность', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'edema', label: 'Отеки', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
    { id: 'edemaExtra', label: 'Описание / локализация отёков', kind: 'textarea' },
    { id: 'rash', label: 'Сыпь', kind: 'select', options: ['unchanged','Есть','Нет'] },
    { id: 'rashExtra', label: 'Описание сыпи', kind: 'textarea' },
  ]},
  { title: 'Дыхательная система', fields: [
    { id: 'throat', label: 'Зев', kind: 'text' },
    { id: 'breath', label: 'Дыхание', kind: 'select', options: ['unchanged','Везикулярное','Жесткое','Ослабленное','Бронхиальное','Отсутствует'] },
    { id: 'rattle', label: 'Хрипы', kind: 'select', options: ['unchanged','Сухие','Влажные','Нет'] },
    { id: 'rattleExtra', label: 'Описание хрипов', kind: 'text' },
    { id: 'dyspnea', label: 'Одышка', kind: 'select', options: ['unchanged','Инспираторная','Экспираторная','Смешанная'] },
    { id: 'percussion', label: 'Перкуторно', kind: 'text' },
  ]},
  { title: 'Сердце, пульс и живот', fields: [
    { id: 'heartRhythm', label: 'Ритмичность тонов сердца', kind: 'select', options: ['unchanged','Ритмичные','Аритмичные'] },
    { id: 'heartSound', label: 'Звучность тонов сердца', kind: 'select', options: ['unchanged','Ясные','Глухие','Приглушённые','Отсутствуют'] },
    { id: 'heartNoise', label: 'Шумы сердца', kind: 'multi', options: ['Систолические','Диастолические','Трение перикарда'] },
    { id: 'pulse', label: 'Пульс: характеристика', kind: 'multi', options: ['Нормальный','Ритмичный','Аритмичный','Напряженный','Слабого наполнения','Нитевидный','Отсутствует'] },
    { id: 'tongueMoisture', label: 'Влажность языка', kind: 'select', options: ['unchanged','Влажный','Сухой'] },
    { id: 'tongueCoating', label: 'Состояние языка', kind: 'select', options: ['unchanged','Чистый','Обложен'] },
    { id: 'abdomenTexture', label: 'Характеристика живота', kind: 'select', options: ['unchanged','Мягкий','Напряжённый'] },
    { id: 'abdomenBreath', label: 'Участвует в акте дыхания', kind: 'select', options: ['unchanged','Да','Нет'] },
    { id: 'peritoneal', label: 'Симптомы раздражения брюшины', kind: 'select', options: ['unchanged','Да','Нет'] },
    { id: 'abdominalPainLocation', label: 'Локализация болей в животе', kind: 'text' },
    { id: 'abdomenTenderness', label: 'Болезненность живота', kind: 'select', options: ['unchanged','Безболезненный','Болезненный'] },
    { id: 'liverSize', label: 'Печень', kind: 'select', options: ['unchanged','Увеличена','Не увеличена'] },
  ]},
  { title: 'Другие данные осмотра', fields: [
    { id: 'urination', label: 'Мочеиспускание', kind: 'text' },
    { id: 'stool', label: 'Стул', kind: 'text' },
    { id: 'otherSymptoms', label: 'Другие симптомы', kind: 'textarea' },
    { id: 'localStatus', label: 'Локальный статус', kind: 'textarea' },
  ]},
  { title: 'Показатели до оказания помощи', fields: [
    { id: 'workingSystolic', label: 'Рабочее АД: систолическое', kind: 'text' },
    { id: 'workingDiastolic', label: 'Рабочее АД: диастолическое', kind: 'text' },
    { id: 'systolic', label: 'Фактическое АД: систолическое', kind: 'text' },
    { id: 'diastolic', label: 'Фактическое АД: диастолическое', kind: 'text' },
    { id: 'pulseRate', label: 'Пульс, уд/мин', kind: 'text' },
    { id: 'heartRate', label: 'ЧСС, уд/мин', kind: 'text' },
    { id: 'breathingRate', label: 'ЧДД, в мин', kind: 'text' },
    { id: 'temperature', label: 'Температура, °C', kind: 'text' },
    { id: 'pulseOximetry', label: 'Пульсоксиметрия, %', kind: 'text' },
    { id: 'glucometry', label: 'Глюкометрия', kind: 'text' },
    { id: 'diagnosisCode', label: 'Код диагноза МКБ-10', kind: 'text', hint: 'Например, I67.2. Код будет передан в расширение и выбран в ProMed.' },
  ]},
  { title: 'Осмотр и оказанная помощь', fields: [
    { id: 'helpOnCallPlace', label: 'Оказанная помощь на месте вызова', kind: 'textarea' },
    { id: 'helpInEmergencyCar', label: 'Оказанная помощь в автомобиле СМП', kind: 'textarea' },
  ]},
  { title: 'Показатели после оказания помощи', fields: [
    { id: 'afterSystolic', label: 'АД после помощи: систолическое', kind: 'text' },
    { id: 'afterDiastolic', label: 'АД после помощи: диастолическое', kind: 'text' },
    { id: 'afterPulse', label: 'Пульс после помощи', kind: 'text' },
    { id: 'afterHeartRate', label: 'ЧСС после помощи', kind: 'text' },
    { id: 'afterBreathingRate', label: 'ЧДД после помощи', kind: 'text' },
    { id: 'afterTemperature', label: 'Температура после помощи', kind: 'text' },
    { id: 'afterPulseOximetry', label: 'Пульсоксиметрия после помощи, %', kind: 'text' },
    { id: 'afterGlucometry', label: 'Глюкометрия после помощи', kind: 'text' },
    { id: 'isKupir', label: 'Купированы боли / приступы', kind: 'select', options: ['unchanged','yes','no'], hint: 'Значения: unchanged, yes, no' },
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
  { title: 'Завершение вызова', fields: [
    { id: 'medicalIntervention', label: 'Медицинское вмешательство: согласие', kind: 'select', options: ['unchanged','Согласие','Отказ'] },
    { id: 'transportConsent', label: 'Транспортировка в стационар', kind: 'select', options: ['unchanged','Согласие','Отказ'] },
    { id: 'careResult', label: 'Результат оказания помощи', kind: 'select', options: ['unchanged','Улучшение','Без эффекта','Ухудшение'] },
    { id: 'aftercareRecommendation', label: 'Рекомендуется обратиться в поликлинику', kind: 'select', options: ['unchanged','Рекомендуется обратиться в поликлинику'] },
    { id: 'deliveryPersonType', label: 'Доставка больного в автомобиль', kind: 'select', options: ['unchanged','Перенесен на носилках','Перенесен на других подручных средствах','Передвигался самостоятельно','На руках'] },
    { id: 'resultTrip', label: 'Результат выезда', kind: 'select', options: ['unchanged','1|401 · Оказана помощь, больной оставлен на месте','2|402 · Доставлен в травмпункт','3|403 · Доставлен в больницу','4|Передан специализированной бригаде СМП','5|Смерть в присутствии бригады СМП','6|Смерть в автомобиле СМП','7|Больной не найден на месте','8|Отказ от помощи','9|Адрес не найден','10|Ложный вызов','11|Смерть до приезда','12|Больной увезён до прибытия СМП','13|Больной обслужен врачом поликлиники до прибытия СМП','14|Вызов отменён','15|Пациент практически здоров','17|Отказ от транспортировки для госпитализации в стационар'] },
    { id: 'totalMileage', label: 'Общий километраж', kind: 'text' },
    { id: 'arrivalMileage', label: 'Километраж доезда', kind: 'text' },
    { id: 'callNote', label: 'Примечание', kind: 'textarea' },
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
    diagnosisCode: typeof t.diagnosisCode === 'string' ? t.diagnosisCode.trim().toUpperCase() : '',
    complaints: typeof t.complaints === 'string' ? t.complaints : '',
    anamnesis: typeof t.anamnesis === 'string' ? t.anamnesis : '',
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
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('smp-card-assistant.categories.v1') || '[]');
      if (Array.isArray(saved)) return Array.from(new Set([...saved.filter((x: unknown): x is string => typeof x === 'string'), ...loadTemplates().map(t => t.category)]));
    } catch {}
    return Array.from(new Set(loadTemplates().map(t => t.category)));
  });
  const [selectedCategory, setSelectedCategory] = useState(() => loadTemplates()[0]?.category || 'Кардиология');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(() => [loadTemplates()[0]?.category || 'Кардиология']);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<'categories' | 'templates' | 'editor'>('categories');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Изменения сохраняются после нажатия «Сохранить».');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryDialog, setCategoryDialog] = useState<{ mode: 'rename' | 'delete'; category: string; value: string } | null>(null);
  const savedSelected = templates.find(t => t.id === selectedId);
  const selected = draft;
  const dirty = Boolean(draft && (!savedSelected || JSON.stringify(draft) !== JSON.stringify(savedSelected)));
  const categoryList = useMemo(() => Array.from(new Set([...categories, ...templates.map(t => t.category), ...(draft ? [draft.category] : [])])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')), [categories, templates, draft]);
  const visibleTemplates = useMemo(() => templates.filter(t => t.category === selectedCategory && (t.diagnosis + ' ' + t.category).toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU'))), [templates, selectedCategory, search]);
  const draftVisible = Boolean(draft && draft.category === selectedCategory && !templates.some(t => t.id === draft.id) && (draft.diagnosis + ' ' + draft.category).toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); }
    catch { setStatus('Не удалось сохранить библиотеку локально. Используйте экспорт JSON.'); }
  }, [templates]);
  useEffect(() => {
    try { localStorage.setItem('smp-card-assistant.categories.v1', JSON.stringify(categories)); }
    catch { setStatus('Не удалось сохранить список категорий. Экспортируйте шаблоны JSON.'); }
  }, [categories]);
  useEffect(() => {
    if (!initialized) {
      if (templates.length) {
        setSelectedId(templates[0].id);
        setSelectedCategory(templates[0].category);
        setDraft({ ...templates[0], extensionFields: { ...templates[0].extensionFields } });
      }
      setInitialized(true);
    }
  }, [initialized, templates]);

  const saveCurrentDraft = (showStatus = true) => {
    if (!draft) return;
    setTemplates(current => {
      const exists = current.some(t => t.id === draft.id);
      return exists ? current.map(t => t.id === draft.id ? { ...draft, extensionFields: { ...draft.extensionFields } } : t) : [...current, { ...draft, extensionFields: { ...draft.extensionFields } }];
    });
    setCategories(current => Array.from(new Set([...current, draft.category])));
    setSelectedCategory(draft.category);
    if (showStatus) setStatus('Шаблон «' + draft.diagnosis + '» сохранён.');
  };
  const navigateTo = (next: Template | null, nextCategory?: string) => {
    if (dirty && draft) {
      const shouldSave = window.confirm('Есть несохранённые изменения. Сохранить их перед переходом? Нажмите «Отмена», чтобы отбросить изменения.');
      if (shouldSave) saveCurrentDraft(false);
    }
    setDraft(next ? { ...next, extensionFields: { ...next.extensionFields } } : null);
    setSelectedId(next?.id || '');
    if (nextCategory) setSelectedCategory(nextCategory);
    setView(next ? 'editor' : 'templates');
    setStatus(next ? 'Открыт шаблон «' + next.diagnosis + '».' : 'Выбрана категория. Создайте или выберите шаблон.');
  };
  const openCategory = (category: string) => {
    if (dirty && draft) {
      const shouldSave = window.confirm('Есть несохранённые изменения. Сохранить их перед переходом к категории? Нажмите «Отмена», чтобы отбросить изменения.');
      if (shouldSave) saveCurrentDraft(false);
    }
    setSelectedCategory(category);
    setSearch('');
    setDraft(null);
    setSelectedId('');
    setView('templates');
    setStatus('Выбрана категория «' + category + '».');
  };
  const goToTemplates = () => {
    if (dirty && draft) {
      const shouldSave = window.confirm('Есть несохранённые изменения. Сохранить их перед возвратом к шаблонам? Нажмите «Отмена», чтобы отбросить изменения.');
      if (shouldSave) saveCurrentDraft(false);
      else {
        const saved = templates.find(t => t.id === draft.id);
        if (saved) setDraft({ ...saved, extensionFields: { ...saved.extensionFields } });
        else setDraft(null);
      }
    }
    setView('templates');
  };
  const update = (key: EditableTextKey, value: string) => {
    setDraft(current => current ? { ...current, [key]: value } : current);
    setStatus('Есть несохранённые изменения.');
  };
  const updateExtensionField = (key: string, value: ExtensionValue) => {
    setDraft(current => current ? { ...current, extensionFields: { ...current.extensionFields, [key]: value } } : current);
    setStatus('Есть несохранённые изменения.');
  };
  const addCategory = () => {
    setNewCategoryName('');
    setShowAddCategory(true);
  };
  const createCategory = () => {
    const value = newCategoryName.trim();
    if (!value) {
      setStatus('Введите название категории.');
      return;
    }
    if (categoryList.some(c => c.toLocaleLowerCase('ru-RU') === value.toLocaleLowerCase('ru-RU'))) {
      setStatus('Такая категория уже существует.');
      return;
    }
    setCategories(current => [...current, value]);
    setExpandedCategories(current => [...current, value]);
    setSelectedCategory(value);
    setSearch('');
    setDraft(null);
    setSelectedId('');
    setView('categories');
    setShowAddCategory(false);
    setNewCategoryName('');
    setStatus('Категория «' + value + '» создана. Теперь выберите её, чтобы добавить шаблоны.');
  };
  const renameCategory = (oldName: string) => {
    setCategoryDialog({ mode: 'rename', category: oldName, value: oldName });
  };
  const deleteCategory = (name: string) => {
    const choices = categoryList.filter(c => c !== name);
    const targets = [...choices, ...(choices.includes('Без категории') ? [] : ['Без категории'])];
    setCategoryDialog({ mode: 'delete', category: name, value: targets[0] || 'Без категории' });
  };
  const applyCategoryDialog = () => {
    if (!categoryDialog) return;
    const { mode, category } = categoryDialog;
    const value = categoryDialog.value.trim();
    if (mode === 'rename') {
      if (!value || value === category) { setCategoryDialog(null); return; }
      if (categoryList.some(c => c.toLocaleLowerCase('ru-RU') === value.toLocaleLowerCase('ru-RU'))) {
        setStatus('Категория с таким названием уже существует.');
        return;
      }
      setCategories(current => current.map(c => c === category ? value : c));
      setExpandedCategories(current => current.map(c => c === category ? value : c));
      setTemplates(current => current.map(t => t.category === category ? { ...t, category: value } : t));
      setDraft(current => current && current.category === category ? { ...current, category: value } : current);
      if (selectedCategory === category) setSelectedCategory(value);
      setStatus('Категория «' + category + '» переименована.');
      setCategoryDialog(null);
      return;
    }
    const targets = [...categoryList.filter(c => c !== category), ...(categoryList.some(c => c !== category && c === 'Без категории') ? [] : ['Без категории'])];
    if (!targets.includes(value)) {
      setStatus('Выберите категорию, в которую перенести шаблоны.');
      return;
    }
    setTemplates(current => current.map(t => t.category === category ? { ...t, category: value } : t));
    setDraft(current => current && current.category === category ? { ...current, category: value } : current);
    setExpandedCategories(current => current.filter(c => c !== category));
    setCategories(current => Array.from(new Set([...current.filter(c => c !== category), value])));
    if (selectedCategory === category) setSelectedCategory(value);
    setStatus('Категория «' + category + '» удалена. Шаблоны перенесены в «' + value + '».');
    setCategoryDialog(null);
  };
  const toggleCategory = (category: string) => {
    setExpandedCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  };
  const newTemplate = (category = selectedCategory) => {
    const t = { ...blank(), category };
    setExpandedCategories(current => current.includes(category) ? current : [...current, category]);
    navigateTo(t, category);
    setStatus('Создан черновик нового шаблона. Нажмите «Сохранить», чтобы добавить его в библиотеку.');
  };
  const copyTemplate = () => {
    if (!draft) return;
    const copy: Template = { ...draft, id: crypto.randomUUID(), diagnosis: draft.diagnosis + ' (копия)', extensionFields: { ...draft.extensionFields } };
    navigateTo(copy, copy.category);
    setStatus('Создана независимая копия. Измените категорию при необходимости и нажмите «Сохранить».');
  };
  const deleteTemplate = () => {
    if (!draft) return;
    if (!templates.some(t => t.id === draft.id)) {
      if (!window.confirm('Отбросить черновик «' + draft.diagnosis + '»?')) return;
    } else {
      if (templates.length < 2) {
        setStatus('Нужен хотя бы один сохранённый шаблон.');
        return;
      }
      if (!window.confirm('Удалить шаблон «' + draft.diagnosis + '»?')) return;
      setTemplates(current => current.filter(t => t.id !== draft.id));
    }
    const next = templates.find(t => t.id !== draft.id);
    setDraft(next ? { ...next, extensionFields: { ...next.extensionFields } } : null);
    setSelectedId(next?.id || '');
    if (next) setSelectedCategory(next.category);
    setStatus('Шаблон удалён или черновик отброшен.');
  };
  const exportJson = () => {
    const output = draft && dirty
      ? templates.some(t => t.id === draft.id) ? templates.map(t => t.id === draft.id ? draft : t) : [...templates, draft]
      : templates;
    const blob = new Blob([JSON.stringify({ schemaVersion: 2, categories: categoryList, templates: output }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'smp-templates.json'; a.click();
    URL.revokeObjectURL(url);
    setStatus('JSON-файл экспортирован' + (draft && dirty ? ' с текущим черновиком.' : '.'));
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
        const importedCategories = Array.from(new Set([...(Array.isArray(data.categories) ? data.categories.filter((x: unknown): x is string => typeof x === 'string') : []), ...normalized.map(t => t.category)]));
        setTemplates(normalized);
        setCategories(importedCategories);
        setSelectedCategory(normalized[0]?.category || 'Без категории');
        setSelectedId(normalized[0]?.id || '');
        setDraft(normalized[0] ? { ...normalized[0], extensionFields: { ...normalized[0].extensionFields } } : null);
        setStatus('Импортировано шаблонов: ' + normalized.length + '. Нажмите «Сохранить» после дальнейшего редактирования.');
      } catch { setStatus('Не удалось прочитать файл. Проверьте формат JSON.'); }
    };
    reader.readAsText(file);
  };
  const getFieldValue = (field: FieldDef): ExtensionValue => {
    const value = selected?.extensionFields[field.id];
    if (value !== undefined) return value;
    if (field.kind === 'check') return false;
    if (field.kind === 'multi') return [];
    return field.kind === 'select' ? 'unchanged' : '';
  };
  const renderField = (field: FieldDef) => {
    if (field.id === 'diagnosisCode') return <label className="field" key={field.id}><span>{field.label}</span><input value={selected?.diagnosisCode || ''} onChange={e => update('diagnosisCode', e.target.value.toUpperCase())} placeholder="Например, I67.2" autoCapitalize="characters" spellCheck={false} />{field.hint ? <small>{field.hint}</small> : null}</label>;
    const value = getFieldValue(field);
    if (field.kind === 'check') return <label className="check-field" key={field.id}><input type="checkbox" checked={Boolean(value)} onChange={e => updateExtensionField(field.id, e.target.checked)} /><span>{field.label}</span></label>;
    if (field.kind === 'multi') return <div className="field multi-field" key={field.id}><span>{field.label}</span><div className="multi-options">{(field.options || []).map(option => <label key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => { const old = Array.isArray(value) ? value : []; updateExtensionField(field.id, e.target.checked ? [...old, option] : old.filter(x => x !== option)); }} />{option}</label>)}</div></div>;
    if (field.kind === 'select') return <label className="field" key={field.id}><span>{field.label}</span><select value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)}>{(field.options || unchanged).map(option => { const separator = option.indexOf('|'); const optionValue = separator >= 0 ? option.slice(0, separator) : option; const optionLabel = separator >= 0 ? option.slice(separator + 1) : option; return <option key={option} value={optionValue}>{optionLabel === 'unchanged' ? 'Не менять' : optionLabel === 'yes' ? 'Да / Есть' : optionLabel === 'no' ? 'Нет' : optionLabel}</option>; })}</select>{field.hint ? <small>{field.hint}</small> : null}</label>;
    if (field.kind === 'textarea') return <label className="field" key={field.id}><span>{field.label}</span><textarea rows={2} value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)} placeholder="Оставь пустым, если менять не нужно" /></label>;
    return <label className="field" key={field.id}><span>{field.label}</span><input value={String(value)} onChange={e => updateExtensionField(field.id, e.target.value)} placeholder="Оставь пустым, если менять не нужно" /></label>;
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">СМП</div><div><h1>SMP Card Assistant</h1><p>Редактор шаблонов карт вызова</p></div><div className="top-spacer"/><button className="primary" onClick={exportJson}>Экспорт JSON</button><label className="button secondary">Импорт JSON<input type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])}/></label></header>
    {categoryDialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setCategoryDialog(null); }}>
      <form className="modal-card" onSubmit={e => { e.preventDefault(); applyCategoryDialog(); }}>
        <h2>{categoryDialog.mode === 'rename' ? 'Переименовать категорию' : 'Удалить категорию'}</h2>
        {categoryDialog.mode === 'rename' ? <>
          <p>Новое название для «{categoryDialog.category}».</p>
          <label className="field"><span>Название категории</span><input autoFocus value={categoryDialog.value} onChange={e => setCategoryDialog(current => current ? { ...current, value: e.target.value } : current)} /></label>
        </> : <>
          <p>Шаблоны из «{categoryDialog.category}» сохранятся и будут перенесены в выбранную категорию.</p>
          <label className="field"><span>Перенести шаблоны в</span><select value={categoryDialog.value} onChange={e => setCategoryDialog(current => current ? { ...current, value: e.target.value } : current)}>{[...categoryList.filter(c => c !== categoryDialog.category), ...(categoryList.some(c => c !== categoryDialog.category && c === 'Без категории') ? [] : ['Без категории'])].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        </>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setCategoryDialog(null)}>Отмена</button><button type="submit" className={categoryDialog.mode === 'delete' ? 'danger-ghost' : 'primary'}>{categoryDialog.mode === 'rename' ? 'Сохранить название' : 'Удалить категорию'}</button></div>
      </form>
    </div>}
    {showAddCategory && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddCategory(false); }}>
      <form className="modal-card" onSubmit={e => { e.preventDefault(); createCategory(); }}>
        <h2>Новая категория</h2>
        <p>Например: Кардиология, Неврология или Терапия.</p>
        <label className="field"><span>Название категории</span><input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Введите название" /></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowAddCategory(false)}>Отмена</button><button type="submit" className="primary">Создать категорию</button></div>
      </form>
    </div>}
    <div className="workspace accordion-workspace">
      <aside className="sidebar">
        <div className="side-heading"><h2>Категории</h2><button title="Добавить категорию" aria-label="Добавить категорию" onClick={addCategory}>＋</button></div>
        <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск категории или диагноза…"/>
        <div className="category-tree">{categoryList.filter(c => c.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')) || templates.some(t => t.category === c && t.diagnosis.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')))).map(category => {
          const matchingTemplates = templates.filter(t => t.category === category && (t.diagnosis + ' ' + t.category).toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')));
          const expanded = expandedCategories.includes(category) || Boolean(search.trim());
          const shownDraft = draft && draft.category === category && !templates.some(t => t.id === draft.id) && (draft.diagnosis + ' ' + draft.category).toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU'));
          return <div className={'category-group ' + (selectedCategory === category ? 'active' : '')} key={category}>
            <div className="category-row">
              <button className="category-select" onClick={() => { setSelectedCategory(category); toggleCategory(category); }} aria-expanded={expanded}>
                <span className="category-chevron">{expanded ? '▾' : '▸'}</span><strong>{category}</strong><span className="category-count">{templates.filter(t => t.category === category).length}</span>
              </button>
              <button className="icon-action" title="Добавить карту вызова в категорию" aria-label={'Добавить карту в ' + category} onClick={() => newTemplate(category)}>＋</button>
              <button className="icon-action" title="Переименовать категорию" aria-label={'Переименовать ' + category} onClick={() => renameCategory(category)}>✎</button>
              <button className="icon-action delete-icon" title="Удалить категорию" aria-label={'Удалить ' + category} onClick={() => deleteCategory(category)}>⌫</button>
            </div>
            {expanded && <div className="category-templates">
              {matchingTemplates.map(t => <div key={t.id} className={'category-template ' + (selectedId === t.id ? 'active' : '')}>
                <button className="category-template-pick" onClick={() => navigateTo(t, t.category)}><span className="template-file-icon">▤</span><strong>{t.diagnosis}</strong></button>
                <button className="icon-action" title="Копировать шаблон" aria-label={'Копировать ' + t.diagnosis} onClick={() => { navigateTo(t, t.category); const copy: Template = { ...t, id: crypto.randomUUID(), diagnosis: t.diagnosis + ' (копия)', extensionFields: { ...t.extensionFields } }; setDraft(copy); setSelectedId(copy.id); setStatus('Создана независимая копия. Измени категорию при необходимости и нажми «Сохранить».'); }}>⧉</button>
              </div>)}
              {shownDraft && <div className="category-template active draft-row"><button className="category-template-pick" onClick={() => setSelectedId(draft!.id)}><span className="template-file-icon">▤</span><strong>{draft.diagnosis}</strong><small>Черновик, не сохранён</small></button><span className="draft-label">Черновик</span></div>}
              {matchingTemplates.length === 0 && !shownDraft && <p className="empty-list">{search.trim() ? 'Нет совпадений в этой категории.' : 'Пока нет карт вызова. Нажми ＋, чтобы создать первую.'}</p>}
            </div>}
          </div>;
        })}</div>
        <p className="sidebar-note">Нажми на категорию, чтобы раскрыть или свернуть карты вызовов. Выбери карту, чтобы открыть редактор справа.</p>
      </aside>
      <section className="template-pane">
        <div className="side-heading"><button className="back-button" onClick={() => setView('categories')} aria-label="Назад к категориям">← Назад</button><h2>Шаблоны</h2><button title="Добавить шаблон" aria-label="Добавить шаблон" onClick={() => newTemplate(selectedCategory)}>＋</button></div>
        <div className="template-list">{visibleTemplates.map(t => <div key={t.id} className={'template-row ' + (selectedId === t.id ? 'active' : '')}>
          <button className="template-pick" onClick={() => navigateTo(t, t.category)}><strong>{t.diagnosis}</strong></button>
          <button className="icon-action" title="Копировать шаблон" aria-label={'Копировать ' + t.diagnosis} onClick={() => { if (draft?.id !== t.id) navigateTo(t, t.category); else copyTemplate(); if (draft?.id !== t.id) { const copy: Template = { ...t, id: crypto.randomUUID(), diagnosis: t.diagnosis + ' (копия)', extensionFields: { ...t.extensionFields } }; setDraft(copy); setSelectedId(copy.id); setStatus('Создана независимая копия. Измени категорию при необходимости и нажми «Сохранить».'); } }}>⧉</button>
          <button className="icon-action" title="Редактировать шаблон" aria-label={'Редактировать ' + t.diagnosis} onClick={() => navigateTo(t, t.category)}>✎</button>
          <button className="icon-action delete-icon" title="Удалить шаблон" aria-label={'Удалить ' + t.diagnosis} onClick={() => { if (draft?.id === t.id) { deleteTemplate(); return; } if (templates.length < 2) { setStatus('Нужен хотя бы один сохранённый шаблон.'); return; } if (!window.confirm('Удалить шаблон «' + t.diagnosis + '»?')) return; setTemplates(current => current.filter(item => item.id !== t.id)); setStatus('Шаблон «' + t.diagnosis + '» удалён.'); }}>⌫</button>
        </div>)}{draftVisible && draft && <div className="template-row active draft-row"><button className="template-pick" onClick={() => setSelectedId(draft.id)}><strong>{draft.diagnosis}</strong><small>Черновик, не сохранён</small></button><span className="draft-label">Черновик</span></div>}{visibleTemplates.length === 0 && !draftVisible && <p className="empty-list">В этой категории пока нет шаблонов.</p>}</div>
      </section>
      {selected ? <section className="editor">
        <div className="page-heading"><div><span className="eyebrow">РЕДАКТОР ШАБЛОНА</span><h2>{selected.diagnosis}</h2><p className={dirty ? 'dirty-note' : 'saved-note'}>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</p></div><div className="template-actions"><button className="secondary" onClick={copyTemplate}>⧉ Копировать</button><button className="danger-ghost" onClick={deleteTemplate}>Удалить</button></div></div>
        <div className="field-grid"><label className="field"><span>Категория</span><select value={selected.category} onChange={e => update('category', e.target.value)}>{categoryList.map(c => <option key={c} value={c}>{c}</option>)}{!categoryList.includes(selected.category) && <option value={selected.category}>{selected.category}</option>}</select></label><label className="field"><span>Название диагноза</span><input value={selected.diagnosis} onChange={e => update('diagnosis', e.target.value)}/></label></div>
        <div className="editor-actions"><button className="primary" onClick={() => saveCurrentDraft()}>Сохранить</button><button className="secondary" onClick={() => { if (!draft) return; const saved = templates.find(t => t.id === draft.id); if (saved) setDraft({ ...saved, extensionFields: { ...saved.extensionFields } }); else { setDraft(null); setSelectedId(''); } setStatus('Несохранённые изменения отменены.'); }}>Отмена</button><span className="editor-action-note">{dirty ? 'Не забудь сохранить изменения' : 'Нет несохранённых изменений'}</span></div>
         <div className="section-title"><h3>Регистрация, жалобы и анамнез</h3><p>Заполняй только нужные поля. Пустые значения не меняют данные карты.</p></div>
         {sections.slice(0, 1).map((section) => <details className="section-card" key={section.title} open><summary>{section.title}<span>{section.fields.length} полей</span></summary><div className="section-fields">{section.fields.map(renderField)}</div></details>)}
         <label className="field"><span>Жалобы</span><textarea value={selected.complaints} onChange={e => update('complaints', e.target.value)} placeholder="Заготовка текста жалоб…" rows={3}/></label>
         <label className="field"><span>Анамнез заболевания</span><textarea value={selected.anamnesis} onChange={e => update('anamnesis', e.target.value)} placeholder="Заготовка анамнеза…" rows={3}/></label>
         <div className="section-title"><h3>Поля карты ProMed</h3><p>«Не менять» оставляет текущее значение в карте. Числовые поля оставляй пустыми, если значение должно вводиться по факту вызова.</p></div>
         {sections.slice(1).map((section, index) => <details className="section-card" key={section.title} open={index === 0}><summary>{section.title}<span>{section.fields.length} полей</span></summary><div className="section-fields">{section.fields.map(renderField)}</div></details>)}
        <div className="notice"><span className="notice-icon">i</span><p>Шаблоны хранятся локально на этом компьютере. Экспортируй JSON и импортируй его в расширение Chrome. Проверь каждое заполненное поле в ProMed и сохраняй карту вручную. Автосохранение самой карты отключено.</p></div>
        <footer className="statusbar"><span className="status-dot"/>{status}<span className="status-spacer"/><span>{templates.length} шабл.</span></footer>
      </section> : <section className="editor empty-state">Выбери шаблон или создай новый в выбранной категории.</section>}
    </div>
  </main>;
}
