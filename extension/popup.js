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

function pageBridge(action, payload) {
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
    const setHeartToneChoice = (choice, label, orderedIndexes) => {
      if (!choice || choice === 'unchanged') return;
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\\s+/g, ' ');
      const groups = window.Ext?.ComponentQuery?.query('segmentedbutton') || [];
      const allButtons = groups.flatMap(group => (group.items?.items || []).map(item => ({item, group})));
      const readText = item => {
        const el = item.el?.dom || item.el;
        return normalize(item.text || item.getText?.() || el?.innerText || el?.textContent || item.tooltip || item.ariaLabel || '');
      };
      let target = allButtons.find(({item}) => readText(item) === normalize(choice));
      if (!target) {
        const index = orderedIndexes[choice];
        if (Number.isInteger(index)) target = allButtons[index];
      }
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
    setHeartToneChoice(payload.heartRhythm, 'Ритмичность тонов сердца', {'Ритмичные':0,'Аритмичные':1});
    setHeartToneChoice(payload.heartSound, 'Звучность тонов сердца', {'Ясные':2,'Глухие':3,'Приглушённые':4,'Отсутствуют':5});
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
    setNamedText('visibledamage_extra', payload.visibleDamageExtra, 'Описание видимых повреждений');
    setNamedText('skincondition', payload.skinCondition, 'Описание кожных покровов');
    setNamedText('edema_extra', payload.edemaExtra, 'Описание отёков');
    setNamedText('rash_extra', payload.rashExtra, 'Описание сыпи');
    setNamedText('isthroat', payload.throat, 'Зев');
    setNamedText('rattle', payload.rattleExtra, 'Описание хрипов');
    setNamedText('percussion', payload.percussion, 'Перкуторно');
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
    const skinFlags = (payload.skinFlags || '').split(',').map(s => s.trim()).filter(Boolean);
    if (skinFlags.length) setNamedChecks('skincondition_id', skinFlags, 'Кожные покровы');
    setNamedChecks('heartnoise_id', payload.heartNoise, 'Шумы сердца');
    setNamedChecks('pulse_id', payload.pulse, 'Пульс');

    return {report, after:{reason:causeInput?.value ?? null, complaints:complaints?.value ?? null, anamnez:anamnez?.value ?? null, epidemic:epidemic?.value ?? null}};
  }
  return {error:'Неизвестное действие'};
}

$('scanFields').addEventListener('click', async () => {
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
    visibleDamage:$('visibleDamage').value, visibleDamageExtra:$('visibleDamageExtra').value,
    skinCondition:$('skinCondition').value, skinFlags:$('skinFlags').value,
    acrocyanosis:$('acrocyanosis').value, marbling:$('marbling').value,
    edema:$('edema').value, edemaExtra:$('edemaExtra').value,
    rash:$('rash').value, rashExtra:$('rashExtra').value, throat:$('throat').value,
    breath:$('breath').value, rattle:$('rattle').value, rattleExtra:$('rattleExtra').value,
    dyspnea:$('dyspnea').value, percussion:$('percussion').value,
    heartRhythm:$('heartRhythm').value, heartSound:$('heartSound').value,
    heartNoise:[...$('heartNoise').selectedOptions].map(o=>o.value),
    pulse:[...$('pulse').selectedOptions].map(o=>o.value),
    abdomenBreath:$('abdomenBreath').value, peritoneal:$('peritoneal').value};
  status.textContent = 'Заполняю выбранные поля…';
  try {
    const result = await runPageAction('fill', payload);
    status.textContent = (result?.report || ['Нет результата']).join('\n') + '\n\nТекущие значения:\n' + JSON.stringify(result?.after || {}, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});
$('scanExamFields').addEventListener('click', async () => {
  status.textContent = 'Ищу компоненты осмотра и их подписи…';
  try { status.textContent = JSON.stringify(await runPageAction('scanExamFields'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});
