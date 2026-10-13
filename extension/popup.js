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

  if (action === 'inspect') {
    return {
      page: location.href,
      extJsAvailable: !!window.Ext,
      reason: causeInput ? {found:true, value:causeInput.value, componentId:causeInput.dataset.componentid,
        selectedRecord:causeCmp?.getSelection?.()?.data ?? null} : {found:false},
      diagnosis: diagnosisInput ? {found:true, value:diagnosisInput.value} : {found:false},
      complaints: complaints ? {found:true, value:complaints.value} : {found:false},
      anamnez: anamnez ? {found:true, value:anamnez.value} : {found:false}
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
    return {report, after:{reason:causeInput?.value ?? null, complaints:complaints?.value ?? null, anamnez:anamnez?.value ?? null}};
  }
  return {error:'Неизвестное действие'};
}

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
    status.textContent = (result?.report || ['Нет результата']).join('\n') + '\n\nТекущие значения:\n' + JSON.stringify(result?.after || {}, null, 2);
  } catch (e) { status.textContent = 'Ошибка: ' + (e?.message || e); }
});