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

  const describeElement = (target) => {
    const el = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
    if (!el) return {error:'Не удалось определить выбранный элемент.'};
    const input = el.matches('input,textarea,select,button,[role="checkbox"],[role="radio"]')
      ? el : el.closest('input,textarea,select,button,[role="checkbox"],[role="radio"]') || el;
    const componentId = input.dataset?.componentid || el.dataset?.componentid || null;
    let cmp = componentId ? window.Ext?.getCmp(componentId) : null;
    if (!cmp && input.id) cmp = window.Ext?.getCmp(input.id) || null;
    if (!cmp && el.id) cmp = window.Ext?.getCmp(el.id) || null;
    const xtype = cmp?.xtype || cmp?.getXType?.() || null;
    const labelNode = input.id ? document.querySelector('label[for="' + CSS.escape(input.id) + '"]') : null;
    const label = cmp?.fieldLabel || cmp?.boxLabel || input.getAttribute('aria-label') ||
      labelNode?.innerText?.trim() || input.getAttribute('title') || null;
    const parentChain = [];
    let node = input;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      parentChain.push({tag:node.tagName?.toLowerCase() || null, id:node.id || null,
        role:node.getAttribute?.('role') || null, className:typeof node.className === 'string' ? node.className.slice(0,160) : null});
    }
    const result = {
      tag: input.tagName?.toLowerCase() || null,
      id: input.id || null,
      name: input.getAttribute?.('name') || cmp?.name || cmp?.getName?.() || null,
      type: input.getAttribute?.('type') || null,
      role: input.getAttribute?.('role') || null,
      ariaLabel: input.getAttribute?.('aria-label') || null,
      placeholder: input.getAttribute?.('placeholder') || null,
      title: input.getAttribute?.('title') || null,
      label,
      checked: typeof input.checked === 'boolean' ? input.checked : (cmp && /checkbox|radio/i.test(String(xtype)) && typeof cmp.getValue === 'function' ? !!cmp.getValue() : null),
      disabled: !!input.disabled,
      readOnly: !!input.readOnly,
      component: cmp ? {
        id: cmp.id || null, xtype, itemId: cmp.itemId || null,
        fieldLabel: cmp.fieldLabel || null, boxLabel: cmp.boxLabel || null,
        name: cmp.name || cmp.getName?.() || null,
        valueField: cmp.valueField || null, displayField: cmp.displayField || null,
        queryMode: cmp.queryMode || null,
        storeModelFields: cmp.getStore?.()?.getModel?.()?.getFields?.()?.map(f => f.name).slice(0,60) || null
      } : null,
      parentChain
    };
    return result;
  };

  if (action === 'startPicker') {
    if (window.__smpcaPickerCleanup) window.__smpcaPickerCleanup();
    window.__smpcaInspectorResult = null;
    let previous = null;
    let previousOutline = '';
    const onMove = (event) => {
      const el = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      if (!el || el === document.documentElement || el === document.body) return;
      if (previous && previous !== el) previous.style.outline = previousOutline;
      previous = el;
      previousOutline = el.style.outline;
      el.style.outline = '3px solid #e11d48';
      el.style.outlineOffset = '1px';
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      if (previous) { previous.style.outline = previousOutline; previous.style.outlineOffset = ''; }
      delete window.__smpcaPickerCleanup;
    };
    const onClick = (event) => {
      const el = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      if (!el || el.closest?.('[data-smpca-overlay]')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.__smpcaInspectorResult = {selectedAt:new Date().toISOString(), element:describeElement(el)};
      cleanup();
      const note = document.createElement('div');
      note.dataset.smpcaOverlay = 'true';
      note.textContent = 'Элемент выбран. Открой SMP Card Assistant и нажми «Получить отчёт».';
      Object.assign(note.style, {position:'fixed',zIndex:'2147483647',right:'16px',top:'16px',maxWidth:'320px',padding:'12px 16px',background:'#166534',color:'#fff',font:'14px system-ui',borderRadius:'8px',boxShadow:'0 4px 18px #0004'});
      document.documentElement.appendChild(note);
      setTimeout(() => note.remove(), 5000);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    window.__smpcaPickerCleanup = cleanup;
    return {started:true, message:'Режим выбора включён. Щёлкни по нужному полю или флажку на странице.'};
  }

  if (action === 'getElementReport') {
    return window.__smpcaInspectorResult || {found:false, message:'Элемент ещё не выбран. Нажми «Выбрать элемент на странице» и щёлкни по элементу.'};
  }

  if (action === 'scanFields') {
    const fields = window.Ext?.ComponentQuery?.query('field') || [];
    return {
      extJsAvailable: !!window.Ext,
      count: fields.length,
      fields: fields.map((cmp, index) => {
        const input = cmp.inputEl?.dom || cmp.inputEl;
        return {
          index, xtype: cmp.xtype || cmp.getXType?.() || null,
          fieldLabel: cmp.fieldLabel || cmp.boxLabel || cmp.label || null,
          name: cmp.name || cmp.getName?.() || null,
          itemId: cmp.itemId || null, componentId: cmp.id || null,
          inputName: input?.name || null, inputId: input?.id || null,
          checked: typeof cmp.getValue === 'function' && /checkbox|radio/i.test(String(cmp.xtype || cmp.getXType?.() || ''))
            ? !!cmp.getValue() : undefined,
          disabled: !!cmp.disabled, readOnly: !!cmp.readOnly,
          valueField: cmp.valueField || null, displayField: cmp.displayField || null,
          queryMode: cmp.queryMode || null
        };
      }).filter(cmp => cmp.fieldLabel || cmp.name || cmp.inputName || /checkbox|radio/i.test(String(cmp.xtype || '')))
    };
  }

  if (action === 'inspect') {
    return {
      page: location.origin + location.pathname,
      extJsAvailable: !!window.Ext,
      reason: causeInput ? {found:true, componentId:causeInput.dataset.componentid || null} : {found:false},
      diagnosis: diagnosisInput ? {found:true} : {found:false},
      complaints: complaints ? {found:true} : {found:false},
      anamnez: anamnez ? {found:true} : {found:false}
    };
  }

  if (action === 'fill') {
    const report = [];
    if (payload.fillReason) {
      if (!causeCmp) report.push('Причина обращения: поле/компонент не найден.');
      else {
        const records = causeCmp.getStore?.()?.getRange?.() || [];
        const record = records.find(r => String(r.get?.('cmpreasonnew_name') ?? r.data?.cmpreasonnew_name ?? '').trim() === payload.reason.trim());
        if (!record) report.push('Причина обращения: выбранный пункт не найден в загруженном справочнике. Поле не менялось.');
        else {
          try {
            if (typeof causeCmp.select === 'function') causeCmp.select(record);
            else causeCmp.setValue(record.get(causeCmp.valueField || 'cmpreasonnew_id'));
            causeCmp.fireEvent?.('select', causeCmp, record);
            report.push('Причина обращения: значение подставлено. Проверь его визуально.');
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
    return {report, after:{reason:!!causeInput, complaints:!!complaints, anamnez:!!anamnez}};
  }
  return {error:'Неизвестное действие'};
}

$('pickElement').addEventListener('click', async () => {
  status.textContent = 'Включаю режим выбора…';
  try {
    const result = await runPageAction('startPicker');
    status.textContent = result?.message || JSON.stringify(result, null, 2);
    window.close();
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});

$('getElementReport').addEventListener('click', async () => {
  status.textContent = 'Получаю технический отчёт…';
  try { status.textContent = JSON.stringify(await runPageAction('getElementReport'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});

$('scanFields').addEventListener('click', async () => {
  status.textContent = 'Изучаю структуру полей ProMed…';
  try { status.textContent = JSON.stringify(await runPageAction('scanFields'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});

$('inspect').addEventListener('click', async () => {
  status.textContent = 'Проверяю поля…';
  try { status.textContent = JSON.stringify(await runPageAction('inspect'), null, 2); }
  catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});

$('fill').addEventListener('click', async () => {
  const payload = {reason:$('reason').value, fillReason:$('fillReason').checked,
    complaints:$('complaints').value, fillComplaints:$('fillComplaints').checked,
    anamnez:$('anamnez').value, fillAnamnez:$('fillAnamnez').checked};
  status.textContent = 'Заполняю выбранные поля…';
  try {
    const result = await runPageAction('fill', payload);
    status.textContent = (result?.report || ['Нет результата']).join('\n') + '\n\nПроверка наличия полей:\n' + JSON.stringify(result?.after || {}, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});
