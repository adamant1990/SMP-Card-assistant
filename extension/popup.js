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
      const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\\s+/g, ' ');
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
    behavior:$('behavior').value, bodyPosition:$('bodyPosition').value};
  status.textContent = 'Заполняю выбранные поля…';
  try {
    const result = await runPageAction('fill', payload);
    status.textContent = (result?.report || ['Нет результата']).join('\n') + '\n\nТекущие значения:\n' + JSON.stringify(result?.after || {}, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});