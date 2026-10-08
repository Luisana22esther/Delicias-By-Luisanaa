import { createSummary } from './summaries.mjs';

export function initializeSummaries(getOrders) {
  const select = document.getElementById('summaryType');
  const preview = document.getElementById('summaryPreview');
  const button = document.getElementById('sendSummary');
  const status = document.getElementById('summaryStatus');
  let sending = false;
  let pendingRequest = null;
  const render = () => {
    preview.innerHTML = createSummary(getOrders(), select.value).html;
    button.disabled = sending || !getOrders().length;
  };
  window.DeliciasSummaries = { render };
  select.addEventListener('change', () => {
    status.textContent = '';
    render();
  });
  button.addEventListener('click', async () => {
    if (sending || !getOrders().length) return;
    const payload = JSON.stringify({ type: select.value, orders: getOrders() });
    if (!pendingRequest || pendingRequest.payload !== payload) {
      pendingRequest = { payload, id: crypto.randomUUID() };
    }
    sending = true;
    button.disabled = true;
    select.disabled = true;
    button.textContent = 'Enviando…';
    status.className = 'summary-status';
    status.textContent = 'Enviando el resumen seleccionado…';
    try {
      const response = await fetch('/.netlify/functions/send-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Summary-Request-Id': pendingRequest.id },
        body: pendingRequest.payload,
        signal: AbortSignal.timeout(25000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (response.status === 429 ? 'Demasiados envíos. Esperá un minuto y volvé a intentar.' : 'No se pudo enviar el resumen. Intentá nuevamente.'));
      status.className = 'summary-status success';
      status.textContent = 'Resumen enviado a cluisanaesther@gmail.com.';
      pendingRequest = null;
    } catch (error) {
      status.className = 'summary-status error';
      status.textContent = error.name === 'TimeoutError' || error.name === 'TypeError'
        ? 'No se pudo confirmar el envío. Revisá tu conexión y volvé a intentar; el reintento evita duplicar el correo.'
        : error.message;
    } finally {
      sending = false;
      select.disabled = false;
      button.textContent = '📧 Enviar a mi Gmail';
      render();
    }
  });
  render();
}
