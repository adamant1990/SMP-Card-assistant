const $ = (id) => document.getElementById(id);
const status = $('status');

async function runPageAction(action, payload = {}) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !/^https?:\/\/smpufav2\.giszrb\.ru\//i.test(tab.url || '')) {
    throw new Error('Открой карту ProMed на smpufav2.giszrb.ru и повтори.');
  }
  const results = await chrome.scripting.executeScript({
    target: {tabId: tab.id}, world: 'MAIN', func: pageBridge, args: [action, payload]
  });
  return results?.[0]?.result;
}

async function pageBridge(action, payload) {
  const causeInput = document.querySelector('input[name="cmpreasonnew_id"]');
  const causeCmp = causeInput && window.Ext?.getCmp(causeInput.dataset.componentid);
  const diagnosisInput = document.querySelector('input[name="diag_id"]');
  const complaints = document.querySelector('textarea[name="complaints"]');
  const anamnez = document.querySelector('textarea[name="anamnez"]');
  const epidemic = document.querySelector('textarea[name="epidemic"]');

  if (action === 'scanFields') {
    const fields = window.Ext?.ComponentQuery?.query('field') || [];
    return {
      extJsAvailable: !!window.Ext,
      count: fields.length,
      fields: fields.map((cmp, index) => {
        const input = cmp.inputEl?.dom || cmp.inputEl;
        return {
          index,
          xtype: cmp.xtype || cmp.getXType?.() || null,
          fieldLabel: cmp.fieldLabel || cmp.label || null,
          boxLabel: cmp.boxLabel || null,
          inputValue: cmp.inputValue ?? null,
          name: cmp.name || cmp.getName?.() || null,
          itemId: cmp.itemId || null,
          componentId: cmp.id || null,
          inputName: input?.name || null,
          inputId: input?.id || null,
          checked: typeof cmp.getValue === 'function' && /checkbox|radio/i.test(String(cmp.xtype || cmp.getXType?.() || ''))
            ? !!cmp.getValue() : undefined
        };
      }).filter(cmp => cmp.fieldLabel || cmp.name || cmp.inputName || /checkbox|radio/i.test(String(cmp.xtype || '')))
    };
  }


  if (action === 'scanExamFields') {
    const all = window.Ext?.ComponentQuery?.query('*') || [];
    const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\\s+/g, ' ');
    const domText = cmp => {
      const el = cmp.el?.dom || cmp.el;
      return String(cmp.text || cmp.getText?.() || cmp.boxLabel || cmp.title || el?.innerText || el?.textContent || '').trim() || null;
    };
    const details = cmp => ({
      xtype: cmp.xtype || cmp.getXType?.() || null,
      id: cmp.id || null,
      itemId: cmp.itemId || null,
      name: cmp.name || cmp.getName?.() || null,
      fieldLabel: cmp.fieldLabel || cmp.label || null,
      boxLabel: cmp.boxLabel || null,
      text: domText(cmp),
      value: typeof cmp.getValue === 'function' ? cmp.getValue() : null,
      inputName: (cmp.inputEl?.dom || cmp.inputEl)?.name || null
    });
    const relevant = /кож|тон сердца|тоны сердца|язык|живот|печен|боль|локализац|отек|перкуторно/i;
    const groups = [];
    all.filter(cmp => /segmentedbutton/i.test(String(cmp.xtype || cmp.getXType?.() || ''))).forEach(cmp => {
      let parents = [];
      let p = cmp.ownerCt;
      let depth = 0;
      while (p && depth < 6) { parents.push(details(p)); p = p.ownerCt; depth++; }
      const choices = (cmp.items?.items || []).map(item => ({
        ...details(item),
        text: domText(item) || String((item.el?.dom || item.el)?.innerText || (item.el?.dom || item.el)?.textContent || '').trim() || null
      }));
      const context = [details(cmp).fieldLabel, details(cmp).text, ...parents.flatMap(x => [x.fieldLabel,x.text,x.itemId,x.name])].filter(Boolean).join(' ');
      if (relevant.test(normalize(context)) || choices.some(x => relevant.test(normalize(x.text)))) {
        groups.push({group:details(cmp), context:parents, choices});
      }
    });
    const result = [];
    all.forEach(cmp => {
      const own = details(cmp);
      let parents = [];
      let p = cmp.ownerCt;
      let depth = 0;
      while (p && depth < 5) { parents.push(details(p)); p = p.ownerCt; depth++; }
      const joined = [own.fieldLabel, own.boxLabel, own.text, ...parents.flatMap(x => [x.fieldLabel,x.text,x.itemId,x.name])].filter(Boolean).join(' ');
      const isChoice = /button|segmented|radio|checkbox/i.test(String(own.xtype || ''));
      if (relevant.test(normalize(joined)) || (isChoice && parents.some(x => relevant.test(normalize([x.fieldLabel,x.text,x.itemId,x.name].filter(Boolean).join(' ')))))) {
        result.push({component:own, parents, siblings:(cmp.ownerCt?.items?.items || []).map(details).slice(0,30)});
      }
    });
    return {extJsAvailable:!!window.Ext, totalComponents:all.length, segmentedGroups:groups.slice(0,100), matches:result.slice(0,250)};
  }

  if (action === 'inspect') {
    return {
      page: location.href,
      extJsAvailable: !!window.Ext,
      reason: causeInput ? {found:true, value:causeInput.value, componentId:causeInput.dataset.componentid,
        selectedRecord:causeCmp?.getSelection?.()?.data ?? null} : {found:false},
      diagnosis: diagnosisInput ? {found:true, value:diagnosisInput.value} : {found:false},
      complaints: complaints ? {found:true, value:complaints.value} : {found:false},
      anamnez: anamnez ? {found:true, value:anamnez.value} : {found:false},
      epidemic: epidemic ? {found:true, value:epidemic.value} : {found:false}
    };
  }

  if (action === 'fill') {
    const report = [];
    if (payload.fillReason) {
      if (!causeCmp) report.push('Причина обращения: поле/компонент не найден.');
      else {
        const records = causeCmp.getStore?.()?.getRange?.() || [];
        const record = records.find(r => String(r.get?.('cmpreasonnew_name') ?? r.data?.cmpreasonnew_name ?? '').trim() === payload.reason.trim());
        if (!record) {
          report.push('Причина обращения: пункт «' + payload.reason + '» не найден в загруженном справочнике. Поле не менялось.');
        } else {
          try {
            if (typeof causeCmp.select === 'function') causeCmp.select(record);
            else causeCmp.setValue(record.get(causeCmp.valueField || 'cmpreasonnew_id'));
            causeCmp.fireEvent?.('select', causeCmp, record);
            report.push('Причина обращения: ' + (causeInput.value || payload.reason) + '. Проверь выбранное значение визуально.');
          } catch (e) { report.push('Причина обращения: не удалось выбрать пункт — ' + String(e?.message || e)); }
        }
      }
    }
    if (payload.resultTrip && payload.resultTrip !== 'unchanged') {
      const combo = (window.Ext?.ComponentQuery?.query('combo[name="resultambulancetrip_id"]') || [])[0];
      if (!combo) {
        report.push('Результат выезда: поле не найдено; значение не менялось.');
      } else {
        const store = combo.getStore?.();
        const valueField = combo.valueField || 'resultambulancetrip_id';
        const record = (store?.getRange?.() || []).find(r =>
          String(r.get?.(valueField) ?? r.data?.[valueField] ?? '') === String(payload.resultTrip)
        );
        if (!record) {
          report.push('Результат выезда: код ' + payload.resultTrip + ' отсутствует в загруженном справочнике; значение не менялось.');
        } else {
          try {
            combo.select(record);
            combo.fireEvent?.('select', combo, record);
            report.push('Результат выезда: выбрано «' +
              (record.get?.('resultambulancetrip_name') ?? record.data?.resultambulancetrip_name ?? payload.resultTrip) +
              '». Проверь значение в ProMed.');
          } catch (e) {
            report.push('Результат выезда: ошибка выбора — ' + String(e?.message || e));
          }
        }
      }
    }
    const setText = (el, value, label) => {
      if (!value?.trim()) { report.push(label + ': пропущено — поле шаблона пустое.'); return; }
      if (!el) { report.push(label + ': поле не найдено.'); return; }
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
      report.push(label + ': текст подставлен; проверь визуально.');
    };
    if (payload.fillComplaints) setText(complaints, payload.complaints, 'Жалобы');
    if (payload.fillAnamnez) setText(anamnez, payload.anamnez, 'Анамнез');
    if (payload.fillEpidemic) setText(epidemic, payload.epidemic, 'Эпидемиологический анамнез');

    const setRadio = (name, choice, label, yesNo = false) => {
      if (!choice || choice === 'unchanged') return;
      const radios = window.Ext?.ComponentQuery?.query('radiofield[name="' + name + '"]') || [];
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
      const wanted = normalize(choice);
      const target = radios.find(cmp => {
        const text = normalize(cmp.boxLabel || cmp.inputEl?.dom?.getAttribute?.('aria-label') || cmp.fieldLabel);
        if (yesNo) return choice === 'yes' ? /да|есть|положит/.test(text) : /нет|отсутств|отрицат/.test(text);
        return text === wanted;
      });
      if (!target) {
        report.push(label + ': вариант «' + choice + '» не найден; поле оставлено без изменений.');
        return;
      }
      try {
        target.setValue(true);
        target.fireEvent?.('change', target, true);
        report.push(label + ': выбрано «' + choice + '»; проверь визуально.');
      } catch (e) {
        report.push(label + ': ошибка переключения — ' + String(e?.message || e));
      }
    };
    const setProcedureTriggers = async choices => {
      if (!Array.isArray(choices) || !choices.length) return;
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
      const aliases = {
        'внутривенное': ['внутривенное введение лекарственных препаратов', 'внутривенное', 'внутривенно', 'в/в введение', 'в/в'],
        'внутримышечное': ['внутримышечное введение лекарственных препаратов', 'внутримышечное', 'внутримышечно', 'в/м введение', 'в/м'],
        'осмотр фельдшера': ['осмотр фельдшером скорой медицинской помощи (специалистом со средним медицинским образованием) при оказании скорой медицинской помощи', 'осмотр фельдшера', 'осмотр фельдшером'],
        'регистрация экг': ['регистрация электрокардиограммы', 'регистрация экг', 'снятие экг', 'снятие электрокардиограммы'],
        'расшифровка экг': ['расшифровка, описание и интерпретация электрокардиографических данных', 'расшифровка экг', 'расшифровка электрокардиограммы', 'интерпретация экг', 'интерпретация электрокардиограммы'],
        'наложение шины': ['наложение шины при переломах костей', 'наложение шины'],
        'катетеризация вены': ['катетеризация кубитальной и других периферических вен', 'катетеризация вены', 'катетеризация периферических вен'],
        'пульсоксиметрия': ['пульсоксиметрия', 'измерение сатурации', 'измерение spo2', 'измерение spo₂']
      };
      const getRows = () => [...document.querySelectorAll('tr.x-grid-row, .x-grid-row')].filter((row, index, all) => row.getClientRects().length && all.indexOf(row) === index);
      const findMatches = (label, rows) => {
        const wanted = normalize(label), terms = (aliases[wanted] || [wanted]).map(normalize);
        return rows.map(row => ({row, cells:[...row.querySelectorAll('td')].map(cell => normalize(cell.innerText || cell.textContent))})).filter(item => item.cells.some(cell => terms.includes(cell)));
      };
      const deadline = Date.now() + 10000;
      let readyRows = getRows(), lastSignature = '', stablePasses = 0;
      while (Date.now() < deadline) {
        const signature = readyRows.map(row => normalize(row.innerText || row.textContent)).join('|');
        if (signature && signature === lastSignature) stablePasses++; else stablePasses = 0;
        lastSignature = signature;
        const allFound = choices.every(label => { const matches = findMatches(label, readyRows); return matches.length === 1 && !!matches[0].row.querySelector('.numTriggersFieldsContainer .positiveTrigger, .positiveTrigger'); });
        if (allFound || (readyRows.length > 0 && stablePasses >= 4)) break;
        await wait(200); readyRows = getRows();
      }
      const availableCount = choices.filter(label => { const matches = findMatches(label, readyRows); return matches.length === 1 && !!matches[0].row.querySelector('.numTriggersFieldsContainer .positiveTrigger, .positiveTrigger'); }).length;
      if (!readyRows.length || availableCount === 0) { report.push('Манипуляции: не удалось подтвердить загрузку таблицы с выбранными пунктами. Открой раздел «Манипуляции» в ProMed, дождись появления строк и повтори заполнение.'); return; }
      for (const label of choices) {
        const exactMatches = findMatches(label, getRows());
        if (exactMatches.length !== 1) {
          const reason = exactMatches.length
            ? 'найдено ' + exactMatches.length + ' точных совпадений'
            : 'точного совпадения в отдельной ячейке нет';
          report.push('Манипуляция «' + label + '»: ' + reason + '; ничего не нажато.');
          continue;
        }
        const row = exactMatches[0].row;
        const trigger = row.querySelector('.numTriggersFieldsContainer .positiveTrigger, .positiveTrigger');
        if (!trigger) {
          const numberField = row.querySelector('.numTriggersFieldsContainer .numberField, .numberField');
          report.push('Манипуляция «' + label + '»: название найдено точно, но ' +
            (numberField ? 'в строке найдено числовое поле, а кнопки positiveTrigger нет' : 'кнопка positiveTrigger не найдена') +
            '; значение не изменено.');
          continue;
        }
        try {
          const numberField = row.querySelector('.numTriggersFieldsContainer .numberField, .numberField');
          const readCount = () => { if (!numberField) return null; const raw = 'value' in numberField ? numberField.value : numberField.textContent; const parsed = Number(String(raw ?? '').replace(',', '.').trim()); return Number.isFinite(parsed) ? parsed : null; };
          const beforeCount = readCount();
          if (beforeCount !== null && beforeCount > 0) { report.push('Манипуляция «' + label + '»: уже указано количество ' + beforeCount + '; повторно не нажимал.'); continue; }
          trigger.click();
          await wait(150);
          const afterCount = readCount();
          if (beforeCount !== null && afterCount !== null && afterCount > beforeCount) report.push('Манипуляция «' + label + '»: подтверждено, количество изменилось с ' + beforeCount + ' на ' + afterCount + '.');
          else if (beforeCount !== null && afterCount === beforeCount) report.push('Манипуляция «' + label + '»: кнопка нажата, но количество не изменилось. Проверь раздел вручную.');
          else report.push('Манипуляция «' + label + '»: кнопка нажата; состояние нельзя подтвердить по числовому полю. Проверь отметку в ProMed.');
          await wait(100);
        } catch (e) {
          report.push('Манипуляция «' + label + '»: ошибка нажатия — ' + String(e?.message || e));
        }
      }
    };
    setRadio('callteamplace_id', payload.callTeamPlace, 'Место получения вызова');
    setRadio('resident_id', payload.residentType, 'Регистрация пациента');
    setRadio('cmpclosecardsocstatus_id', payload.socialStatus, 'Социальное положение');
    setRadio('execution', payload.execution, 'Исполнение');
    setRadio('trauma_id', payload.traumaType, 'Травма');
    setRadio('isalcoholIntoxication', payload.alcoholIntoxication, 'Наличие опьянения', true);
    setRadio('deliverypersontype_id', payload.deliveryPersonType, 'Доставка больного в автомобиль');
    setRadio('isKupir', payload.isKupir, 'Купированы боли / приступы', true);
    setRadio('aftercarerecomendations_id', payload.aftercareRecommendation, 'Рекомендация пациенту');
    setRadio('isallerg', payload.allergy, 'Аллергия', true);
    setRadio('isforeigndeparture', payload.foreignTrip, 'Выезд за пределы территории', true);
    setRadio('isvillagedeparture', payload.villageTrip, 'Выезд в село', true);
    setRadio('isinfectioncontact', payload.infectionContact, 'Контакт с инфекционными больными', true);
    setRadio('islow-qualityproducts', payload.lowQualityProducts, 'Употребление некачественных продуктов');
    setRadio('condition_id', payload.generalCondition, 'Общее состояние');
    setRadio('behavior_id', payload.behavior, 'Поведение');
    setRadio('bodyposition_id', payload.bodyPosition, 'Положение тела');
    setRadio('conscious_id', payload.consciousness, 'Сознание');
    setRadio('consciousmeningeal_issigns', payload.meningeal, 'Менингеальные знаки', true);
    setRadio('pupil_id', payload.pupils, 'Зрачки');
    setRadio('pupil_isnystagmus', payload.nystagmus, 'Нистагм', true);
    setRadio('pupil_isanisocoria', payload.anisocoria, 'Анизокория', true);
    setRadio('pupil_islightreaction', payload.lightReaction, 'Реакция зрачков на свет', true);
    setRadio('islargefontanelletense', payload.fontanelle, 'Большой родничок', true);
    setRadio('iscornealreflexes', payload.cornealReflexes, 'Корнеальные рефлексы', true);
    setRadio('isbeloglazovsyndrome', payload.beloglazov, 'Симптом Белоглазова');
    setRadio('isvisibledamage', payload.visibleDamage, 'Видимые повреждения', true);
    setRadio('skin_isacrocyanosi', payload.acrocyanosis, 'Акроцианоз', true);
    setRadio('skin_ismramor', payload.marbling, 'Мраморность кожи', true);
    setRadio('edema_isexist', payload.edema, 'Отёки', true);
    setRadio('isrash', payload.rash, 'Сыпь', true);
    setRadio('breath_id', payload.breath, 'Дыхание');
    setRadio('rattle_id', payload.rattle, 'Хрипы', true);
    setRadio('dyspneacmp_id', payload.dyspnea, 'Одышка');
    setRadio('stomach_isactbreath', payload.abdomenBreath, 'Участие живота в акте дыхания', true);
    setRadio('stomach_isperitIrritation', payload.peritoneal, 'Симптомы раздражения брюшины', true);
    const setHeartToneChoice = (choice, label) => {
      if (!choice || choice === 'unchanged') return;
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\\s+/g, ' ');
      const groups = window.Ext?.ComponentQuery?.query('segmentedbutton') || [];
      const allButtons = groups.flatMap(group => (group.items?.items || []).map(item => ({item, group})));
      const readText = item => {
        const el = item.el?.dom || item.el;
        return normalize(item.text || item.getText?.() || el?.innerText || el?.textContent || item.tooltip || item.ariaLabel || '');
      };
      const target = allButtons.find(({item}) => readText(item) === normalize(choice));
      if (!target?.item) {
        report.push(label + ': не удалось найти кнопку «' + choice + '»; поле не менялось.');
        return;
      }
      try {
        const item = target.item;
        const el = item.el?.dom || item.el;
        if (typeof item.toggle === 'function') item.toggle(true);
        else if (typeof item.setPressed === 'function') item.setPressed(true);
        else if (el?.click) el.click();
        else throw new Error('нет доступного способа выбрать кнопку');
        report.push(label + ': выбрано «' + choice + '»; проверь визуально в ProMed.');
      } catch (e) {
        report.push(label + ': ошибка выбора — ' + String(e?.message || e));
      }
    };
    setHeartToneChoice(payload.heartRhythm, 'Ритмичность тонов сердца');
    setHeartToneChoice(payload.heartSound, 'Звучность тонов сердца');
    setHeartToneChoice(payload.tongueMoisture, 'Влажность языка');
    setHeartToneChoice(payload.tongueCoating, 'Состояние языка');
    const setSegmentedGroupChoice = (choice, expectedOptions, label, occurrence = null) => {
      if (!choice || choice === 'unchanged') return;
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
      const expected = expectedOptions.map(normalize);
      const groups = window.Ext?.ComponentQuery?.query('segmentedbutton') || [];
      const readText = item => {
        const el = item.el?.dom || item.el;
        return normalize(item.text || item.getText?.() || el?.innerText || el?.textContent || item.tooltip || item.ariaLabel || '');
      };
      const candidates = groups.map(group => ({group, items:group.items?.items || []})).filter(({items}) => {
        const texts = items.map(readText);
        return expected.every(option => texts.includes(option));
      });
      let selectedGroup;
      if (occurrence !== null) {
        selectedGroup = candidates[occurrence];
        if (!selectedGroup) {
          report.push(label + ': группа кнопок №' + (occurrence + 1) + ' не найдена среди ' + candidates.length + ' совпадений; поле не менялось.');
          return;
        }
      } else {
        if (candidates.length !== 1) {
          report.push(label + ': не удалось однозначно определить группу кнопок (' + candidates.length + ' совпадений); поле не менялось.');
          return;
        }
        selectedGroup = candidates[0];
      }
      const target = selectedGroup.items.find(item => readText(item) === normalize(choice));
      if (!target) { report.push(label + ': вариант «' + choice + '» не найден; поле не менялось.'); return; }
      try {
        const el = target.el?.dom || target.el;
        if (typeof target.toggle === 'function') target.toggle(true);
        else if (typeof target.setPressed === 'function') target.setPressed(true);
        else if (el?.click) el.click();
        else throw new Error('нет доступного способа выбрать кнопку');
        report.push(label + ': выбрано «' + choice + '»; проверь визуально в ProMed.');
      } catch (e) { report.push(label + ': ошибка выбора — ' + String(e?.message || e)); }
    };
    setSegmentedGroupChoice(payload.abdomenTexture, ['Мягкий','Напряжённый'], 'Характеристика живота');
    setSegmentedGroupChoice(payload.abdomenTenderness, ['Безболезненный','Болезненный'], 'Болезненность живота');
    setSegmentedGroupChoice(payload.liverSize, ['Увеличена','Не увеличена'], 'Печень');
    setSegmentedGroupChoice(payload.medicalIntervention, ['Согласие','Отказ'], 'Медицинское вмешательство', 0);
    setSegmentedGroupChoice(payload.transportConsent, ['Согласие','Отказ'], 'Транспортировка в стационар', 1);
    setSegmentedGroupChoice(payload.careResult, ['Улучшение','Без эффекта','Ухудшение'], 'Результат оказания СМП');
    const setNamedText = (name, value, label) => {
      if (!value?.trim()) return;
      const cmp = (window.Ext?.ComponentQuery?.query('field[name="' + name + '"]') || [])[0];
      if (!cmp) { report.push(label + ': поле ' + name + ' не найдено.'); return; }
      try {
        if (typeof cmp.setValue === 'function') cmp.setValue(value);
        else if (cmp.inputEl?.dom) cmp.inputEl.dom.value = value;
        cmp.fireEvent?.('change', cmp, value);
        report.push(label + ': текст подставлен; проверь визуально.');
      } catch (e) { report.push(label + ': ошибка — ' + String(e?.message || e)); }
    };
    setNamedText('before_urination', payload.urination, 'Мочеиспускание');
    setNamedText('before_stool', payload.stool, 'Стул');
    setNamedText('before_othersymptom', payload.otherSymptoms, 'Другие симптомы');
    setNamedText('before_localstatus', payload.localStatus, 'Локальный статус');
    setNamedText('before_workarterial_pressure', payload.workingSystolic, 'Рабочее АД, систолическое');
    setNamedText('before_workarterial_pressure1', payload.workingDiastolic, 'Рабочее АД, диастолическое');
    setNamedText('before_arterial_pressure', payload.systolic, 'АД, систолическое');
    setNamedText('before_arterial_pressure1', payload.diastolic, 'АД, диастолическое');
    setNamedText('before_pulse', payload.pulseRate, 'Пульс');
    setNamedText('before_heart_rate', payload.heartRate, 'ЧСС');
    setNamedText('before_breathing_rate', payload.breathingRate, 'ЧДД');
    setNamedText('before_temperature', payload.temperature, 'Температура');
    setNamedText('before_pulseoximetry', payload.pulseOximetry, 'Пульсоксиметрия');
    setNamedText('before_glucometry', payload.glucometry, 'Глюкометрия');
    setNamedText('helponcallplace', payload.helpOnCallPlace, 'Оказанная помощь на месте вызова');
    setNamedText('helpinemergencycar', payload.helpInEmergencyCar, 'Оказанная помощь в автомобиле СМП');
    setNamedText('after_arterial_pressure', payload.afterSystolic, 'АД после манипуляций, систолическое');
    setNamedText('after_arterial_pressure1', payload.afterDiastolic, 'АД после манипуляций, диастолическое');
    setNamedText('after_pulse', payload.afterPulse, 'Пульс после манипуляций');
    setNamedText('after_heart_rate', payload.afterHeartRate, 'ЧСС после манипуляций');
    setNamedText('after_breathing_rate', payload.afterBreathingRate, 'ЧДД после манипуляций');
    setNamedText('after_temperature', payload.afterTemperature, 'Температура после манипуляций');
    setNamedText('after_pulseoximetry', payload.afterPulseOximetry, 'Пульсоксиметрия после манипуляций');
    setNamedText('after_glucometry', payload.afterGlucometry, 'Глюкометрия после манипуляций');
    await setProcedureTriggers(payload.procedures);
    setNamedText('visibledamage_extra', payload.visibleDamageExtra, 'Описание видимых повреждений');
    setNamedText('skincondition', payload.skinCondition, 'Описание кожных покровов');
    setNamedText('edema_extra', payload.edemaExtra, 'Описание отёков');
    setNamedText('rash_extra', payload.rashExtra, 'Описание сыпи');
    setNamedText('isthroat', payload.throat, 'Зев');
    setNamedText('rattle', payload.rattleExtra, 'Описание хрипов');
    setNamedText('percussion', payload.percussion, 'Перкуторно');
    setNamedText('stomach_local', payload.abdominalPainLocation, 'Локализация болей в животе');
    setNamedText('desctext', payload.callNote, 'Примечание');
    setNamedText('cmpclosecard_userkilo', payload.arrivalMileage, 'Километраж доезда');
    setNamedText('milage', payload.totalMileage, 'Общий километраж');
    const setNamedChecks = (name, choices, label) => {
      if (!Array.isArray(choices) || !choices.length) return;
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
      const comps = window.Ext?.ComponentQuery?.query('checkboxfield[name="' + name + '"]') || [];
      const wanted = new Set(choices.map(normalize));
      if (!comps.length) { report.push(label + ': группа ' + name + ' не найдена.'); return; }
      let matched = 0;
      comps.forEach(cmp => {
        const text = normalize(cmp.boxLabel || cmp.inputValue || cmp.inputEl?.dom?.getAttribute?.('aria-label') || cmp.fieldLabel);
        if (wanted.has(text)) {
          try { cmp.setValue(true); cmp.fireEvent?.('change', cmp, true); matched++; } catch (_) {}
        }
      });
      report.push(matched ? label + ': отмечено ' + matched + ' пункт(а); проверь визуально.' : label + ': выбранные варианты не найдены; поле не менялось.');
    };
    const skinFlags = Array.isArray(payload.skinFlags) ? payload.skinFlags : (payload.skinFlags || '').split(',').map(s => s.trim()).filter(Boolean);
    if (skinFlags.length) setNamedChecks('skincondition_id', skinFlags, 'Кожные покровы');
    setNamedChecks('heartnoise_id', payload.heartNoise, 'Шумы сердца');
    setNamedChecks('pulse_id', payload.pulse, 'Пульс');

    return {report, after:{reason:causeInput?.value ?? null, complaints:complaints?.value ?? null, anamnez:anamnez?.value ?? null, epidemic:epidemic?.value ?? null}};
  }
  return {error:'Неизвестное действие'};
}

$('scanFields')?.addEventListener('click', async () => {
  status.textContent = 'Изучаю структуру полей ProMed…';
  try {
    const result = await runPageAction('scanFields');
    status.textContent = JSON.stringify(result, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});

$('inspect').addEventListener('click', async () => {
  status.textContent = 'Проверяю поля…';
  try { status.textContent = JSON.stringify(await runPageAction('inspect'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});
$('fill').addEventListener('click', async () => {
  const payload = {reason:$('reason').value, fillReason:$('fillReason').checked,
    complaints:$('complaints').value, fillComplaints:$('fillComplaints').checked,
    anamnez:$('anamnez').value, fillAnamnez:$('fillAnamnez').checked,
    epidemic:$('epidemic').value, fillEpidemic:$('fillEpidemic').checked,
    allergy:$('allergy').value, foreignTrip:$('foreignTrip').value,
    villageTrip:$('villageTrip').value, infectionContact:$('infectionContact').value,
    lowQualityProducts:$('lowQualityProducts').value, generalCondition:$('generalCondition').value,
    behavior:$('behavior').value, bodyPosition:$('bodyPosition').value,
    consciousness:$('consciousness').value, meningeal:$('meningeal').value, pupils:$('pupils').value,
    nystagmus:$('nystagmus').value, anisocoria:$('anisocoria').value, lightReaction:$('lightReaction').value,
    fontanelle:$('fontanelle').value, cornealReflexes:$('cornealReflexes').value, beloglazov:$('beloglazov').value,
    urination:$('urination').value, stool:$('stool').value,
    otherSymptoms:$('otherSymptoms').value, localStatus:$('localStatus').value,
    workingSystolic:$('workingSystolic').value, workingDiastolic:$('workingDiastolic').value,
    systolic:$('systolic').value, diastolic:$('diastolic').value,
    pulseRate:$('pulseRate').value, heartRate:$('heartRate').value,
    breathingRate:$('breathingRate').value, temperature:$('temperature').value,
    pulseOximetry:$('pulseOximetry').value, glucometry:$('glucometry').value,
    helpOnCallPlace:$('helpOnCallPlace').value, helpInEmergencyCar:$('helpInEmergencyCar').value,
    afterSystolic:$('afterSystolic').value, afterDiastolic:$('afterDiastolic').value,
    afterPulse:$('afterPulse').value, afterHeartRate:$('afterHeartRate').value,
    afterBreathingRate:$('afterBreathingRate').value, afterTemperature:$('afterTemperature').value,
    afterPulseOximetry:$('afterPulseOximetry').value, afterGlucometry:$('afterGlucometry').value,
    visibleDamage:$('visibleDamage').value, visibleDamageExtra:$('visibleDamageExtra').value,
    skinCondition:$('skinCondition').value, skinFlags:[['skinPale','Бледные'],['skinHyperemic','Гиперемированные'],['skinJaundiced','Желтушные'],['skinNormal','Нормальные'],['skinDry','Сухие'],['skinMoist','Влажные']].filter(([id])=>$(id).checked).map(([,label])=>label),
    acrocyanosis:$('acrocyanosis').value, marbling:$('marbling').value,
    edema:$('edema').value, edemaExtra:$('edemaExtra').value,
    rash:$('rash').value, rashExtra:$('rashExtra').value, throat:$('throat').value,
    breath:$('breath').value, rattle:$('rattle').value, rattleExtra:$('rattleExtra').value,
    dyspnea:$('dyspnea').value, percussion:$('percussion').value,
    heartRhythm:$('heartRhythm').value, heartSound:$('heartSound').value,
    tongueMoisture:$('tongueMoisture').value, tongueCoating:$('tongueCoating').value,
    abdomenTexture:$('abdomenTexture').value, abdomenTenderness:$('abdomenTenderness').value,
    abdominalPainLocation:$('abdominalPainLocation').value, liverSize:$('liverSize').value,
    heartNoise:[...$('heartNoise').selectedOptions].map(o=>o.value),
    pulse:[...$('pulse').selectedOptions].map(o=>o.value),
    abdomenBreath:$('abdomenBreath').value, peritoneal:$('peritoneal').value,
    procedures:[['procIV','Внутривенное'],['procIM','Внутримышечное'],['procNasalPacking','Задняя тампонада носа'],['procGlucose','Измерение глюкозы'],['procVeinCatheter','Катетеризация вены'],['procSplint','Наложение шины'],['procParamedicExam','Осмотр фельдшера'],['procPulseOx','Пульсоксиметрия'],['procECG','Регистрация ЭКГ'],['procECGInterpretation','Расшифровка ЭКГ']].filter(([id])=>$(id).checked).map(([,label])=>label),
    callTeamPlace:$('callTeamPlace').value, residentType:$('residentType').value,
    socialStatus:$('socialStatus').value,
    execution:$('execution').value, traumaType:$('traumaType').value,
    alcoholIntoxication:$('alcoholIntoxication').value,
    deliveryPersonType:$('deliveryPersonType').value, callNote:$('callNote').value,
    arrivalMileage:$('arrivalMileage').value, totalMileage:$('totalMileage').value,
    isKupir:$('isKupir').value, medicalIntervention:$('medicalIntervention').value,
    transportConsent:$('transportConsent').value, careResult:$('careResult').value,
    aftercareRecommendation:$('aftercareRecommendation').value,
    resultTrip:$('resultTrip').value};
  status.textContent = 'Заполняю выбранные поля…';
  try {
    const result = await runPageAction('fill', payload);
    status.textContent = (result?.report || ['Нет результата']).join('\n') + '\n\nТекущие значения:\n' + JSON.stringify(result?.after || {}, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});
$('scanExamFields')?.addEventListener('click', async () => {
  status.textContent = 'Ищу компоненты осмотра и их подписи…';
  try { status.textContent = JSON.stringify(await runPageAction('scanExamFields'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});


// Импорт шаблонов, экспортированных из Windows-программы.
// Храним только локально в Chrome; данные карты на сервер не отправляются.
const templateFile = $('templateFile');
const templateSelect = $('templateSelect');
const templateSearch = $('templateSearch');
const templateCount = $('templateCount');
const applyTemplateButton = $('applyTemplate');
let importedTemplates = [];

function renderTemplateOptions(selectedId = '') {
  const previousId = selectedId || (templateSelect.value !== '' ? importedTemplates[Number(templateSelect.value)]?.id : '') || '';
  const query = (templateSearch?.value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const matches = importedTemplates.map((template, index) => ({template, index})).filter(({template}) =>
    normalize(template.category + ' ' + template.diagnosis).includes(query)
  );
  templateSelect.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = importedTemplates.length ? (matches.length ? 'Выбери диагноз…' : 'Ничего не найдено') : 'Сначала импортируй JSON';
  templateSelect.append(first);
  matches.forEach(({template, index}) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = (template.category ? template.category + ' · ' : '') + template.diagnosis;
    templateSelect.append(option);
  });
  if (previousId) {
    const index = matches.find(({template}) => template.id === previousId)?.index;
    if (index !== undefined) templateSelect.value = String(index);
  }
  if (templateCount) templateCount.textContent = query
    ? 'Найдено: ' + matches.length + ' из ' + importedTemplates.length
    : 'Загруженные шаблоны: ' + importedTemplates.length;
}

templateSearch?.addEventListener('input', () => renderTemplateOptions());

async function restoreImportedTemplates() {
  try {
    const stored = await chrome.storage.local.get('smpImportedTemplates');
    importedTemplates = Array.isArray(stored.smpImportedTemplates) ? stored.smpImportedTemplates : [];
    renderTemplateOptions();
  } catch (error) {
    status.textContent = 'Не удалось прочитать локальные шаблоны: ' + (error?.message || error);
  }
}

templateFile.addEventListener('change', async () => {
  const file = templateFile.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.templates;
    if (!Array.isArray(incoming) || !incoming.every(t =>
      t && typeof t.category === 'string' && typeof t.diagnosis === 'string'
      && ['complaints', 'anamnesis', 'examination', 'treatment'].every(k => t[k] === undefined || typeof t[k] === 'string')
    )) {
      throw new Error('Файл не похож на JSON-шаблоны SMP Card Assistant.');
    }
    importedTemplates = incoming.map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : 'imported-' + i,
      category: t.category,
      diagnosis: t.diagnosis,
      complaints: t.complaints || '',
      anamnesis: t.anamnesis || '',
      examination: t.examination || '',
      treatment: t.treatment || '',
      extensionFields: t.extensionFields && typeof t.extensionFields === 'object' && !Array.isArray(t.extensionFields)
        ? Object.fromEntries(Object.entries(t.extensionFields).filter(([, value]) =>
            typeof value === 'string' || typeof value === 'boolean' ||
            (Array.isArray(value) && value.every(item => typeof item === 'string'))
          ))
        : {}
    }));
    await chrome.storage.local.set({smpImportedTemplates: importedTemplates});
    renderTemplateOptions();
    status.textContent = 'Загружено шаблонов: ' + importedTemplates.length + '. Список сохранён локально в Chrome.';
  } catch (error) {
    status.textContent = 'Ошибка импорта шаблонов: ' + (error?.message || error);
  } finally {
    templateFile.value = '';
  }
});

applyTemplateButton.addEventListener('click', () => {
  const index = Number(templateSelect.value);
  if (!templateSelect.value || !Number.isInteger(index) || !importedTemplates[index]) {
    status.textContent = 'Сначала выбери диагноз из импортированных шаблонов.';
    return;
  }
  const template = importedTemplates[index];
  const hasCurrentText = $('complaints').value.trim() || $('anamnez').value.trim();
  if (hasCurrentText && !window.confirm('Тексты жалоб и/или анамнеза уже заполнены. Заменить их выбранным шаблоном?')) return;
  $('complaints').value = template.complaints;
  $('anamnez').value = template.anamnesis;
  $('fillComplaints').checked = Boolean(template.complaints.trim());
  $('fillAnamnez').checked = Boolean(template.anamnesis.trim());

  const fieldReport = [];
  let appliedFieldCount = 0;
  const extensionFields = template.extensionFields && typeof template.extensionFields === 'object' ? template.extensionFields : {};
  Object.entries(extensionFields).forEach(([id, value]) => {
    const element = $(id);
    if (!element) { fieldReport.push(id + ': поля нет в текущей версии расширения.'); return; }
    if (element.tagName === 'SELECT' && element.multiple) {
      if (!Array.isArray(value)) return;
      const wanted = new Set(value.map(String));
      Array.from(element.options).forEach(option => { option.selected = wanted.has(option.value); });
      appliedFieldCount++;
    } else if (element.type === 'checkbox') {
      if (typeof value === 'boolean') { element.checked = value; appliedFieldCount++; }
    } else if (element.tagName === 'SELECT') {
      if (typeof value !== 'string') return;
      const option = Array.from(element.options).find(item => item.value === value || item.textContent.trim() === value);
      if (option) { element.value = option.value; appliedFieldCount++; }
      else fieldReport.push(id + ': вариант «' + value + '» отсутствует в списке расширения.');
    } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      if (typeof value === 'string' && value.trim()) {
        // Числовые поля браузера не принимают десятичную запятую, хотя пользователь
        // может ввести температуру в привычном формате 36,6 в Windows-программе.
        const normalizedValue = element instanceof HTMLInputElement && element.type === 'number'
          ? value.trim().replace(',', '.')
          : value;
        element.value = normalizedValue;
        if (element.value === normalizedValue) appliedFieldCount++;
        else fieldReport.push(id + ': значение «' + value + '» не подходит для поля; проверь формат.');
      }
    }
  });

  if (extensionFields.reason) $('fillReason').checked = extensionFields.reason !== 'unchanged';
  $('fillEpidemic').checked = Boolean($('epidemic').value.trim());
  status.textContent = 'Шаблон «' + template.diagnosis + '» перенесён в расширение. Отдельных полей обработано: ' + appliedFieldCount + '. Проверь значения, затем нажми «Заполнить выбранные поля».' +
    (fieldReport.length ? '\n\nЗамечания:\n' + fieldReport.join('\n') : '');
});

restoreImportedTemplates();
