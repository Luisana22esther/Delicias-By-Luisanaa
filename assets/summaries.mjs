export const summaryTitles = Object.freeze({
  general: 'Resumen general',
  sales: 'Ventas y cobros',
  pending: 'Pendientes de cobro y entrega',
  complete: 'Detalle completo de pedidos'
});

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(value);
}

export function createSummary(orders, type) {
  if (!Object.hasOwn(summaryTitles, type)) throw new Error('Resumen inválido.');
  const sum = list => list.reduce((total, order) => total + order.total, 0);
  const countBoxes = list => list.reduce((total, order) => total + order.qty, 0);
  const paid = orders.filter(order => order.paid);
  const unpaid = orders.filter(order => !order.paid);
  const undelivered = orders.filter(order => !order.delivered);
  const metrics = [
    ['Pedidos', orders.length],
    ['Boxes', countBoxes(orders)],
    ['Total vendido', formatMoney(sum(orders))],
    ['Total cobrado', formatMoney(sum(paid))],
    ['Pendiente de cobro', formatMoney(sum(unpaid))],
    ['Pendientes de entrega', undelivered.length]
  ];
  const lines = [summaryTitles[type], 'Delicias By Luisana', '', ...metrics.map(([label, value]) => `${label}: ${value}`)];
  let html = `<div class="summary-metrics">${metrics.map(([label, value]) => `<div class="summary-metric"><span>${label}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div>`;
  const addSection = (title, sectionOrders, detailed = false) => {
    lines.push('', title);
    html += `<h3>${escapeHtml(title)}</h3>`;
    if (!sectionOrders.length) {
      lines.push('Sin pedidos en esta sección.');
      html += '<p class="price">Sin pedidos en esta sección.</p>';
      return;
    }
    html += '<div class="summary-orders">';
    for (const order of sectionOrders) {
      const description = `BOX ${order.box} · ${order.qty} box${order.qty > 1 ? 'es' : ''} · ${formatMoney(order.total)}`;
      const status = `${order.paid ? 'Pagado' : 'Pago pendiente'} · ${order.delivered ? 'Entregado' : 'Entrega pendiente'}`;
      lines.push(`${order.name} — ${description}`, `Teléfono: ${order.phone || 'Sin teléfono'} · Entrega: ${order.date || 'Sin fecha'}`, status);
      html += `<div class="card"><div class="card-top"><div class="name">${escapeHtml(order.name)}</div><div class="total">${escapeHtml(formatMoney(order.total))}</div></div><div class="meta">${escapeHtml(description)}<br>Teléfono: ${escapeHtml(order.phone || 'Sin teléfono')}<br>Entrega: ${escapeHtml(order.date || 'Sin fecha')}<br>${escapeHtml(status)}`;
      if (detailed) {
        lines.push(`ID: ${order.id}`, `Observaciones: ${order.notes || 'Sin observaciones'}`);
        html += `<br>ID: ${escapeHtml(order.id)}<br>Observaciones: ${escapeHtml(order.notes || 'Sin observaciones')}`;
      }
      html += '</div></div>';
    }
    html += '</div>';
  };
  if (type === 'general' || type === 'sales') {
    const heading = type === 'general' ? 'Pedidos por box' : 'Ventas y cobros por box';
    lines.push('', heading);
    html += `<h3>${heading}</h3>`;
    for (const box of [1, 2, 3]) {
      const boxOrders = orders.filter(order => order.box === box);
      const description = `BOX ${box}: ${boxOrders.length} pedidos · ${countBoxes(boxOrders)} boxes · Vendido: ${formatMoney(sum(boxOrders))} · Cobrado: ${formatMoney(sum(boxOrders.filter(order => order.paid)))} · Por cobrar: ${formatMoney(sum(boxOrders.filter(order => !order.paid)))}`;
      lines.push(description);
      html += `<p class="meta">${escapeHtml(description)}</p>`;
    }
  }
  if (type === 'sales') {
    addSection('Pedidos cobrados', paid);
    addSection('Pedidos pendientes de cobro', unpaid);
  }
  if (type === 'pending') {
    addSection('Pendientes de cobro', unpaid, true);
    addSection('Pendientes de entrega', undelivered, true);
    lines.push('', 'Un pedido puede aparecer en ambas listas si falta cobrarlo y entregarlo.');
    html += '<p class="price">Un pedido puede aparecer en ambas listas si falta cobrarlo y entregarlo.</p>';
  }
  if (type === 'complete') addSection('Todos los pedidos', orders, true);
  if (!orders.length) {
    lines.push('', 'Todavía no hay pedidos cargados.');
    html += '<p class="empty">Todavía no hay pedidos cargados.</p>';
  }
  return { title: summaryTitles[type], html, text: lines.join('\n') };
}
