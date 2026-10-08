import type { Config } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { createSummary, escapeHtml, summaryTitles } from '../../assets/summaries.mjs';

function reply(status: number, body: Record<string, unknown>, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function validateOrders(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 1000) return null;
  const validText = (text: unknown, limit: number) => typeof text === 'string' && text.length <= limit;
  const orders = [];
  for (const order of value) {
    if (!order || typeof order !== 'object' ||
      !Number.isSafeInteger(order.id) || order.id <= 0 ||
      ![1, 2, 3].includes(order.box) ||
      !Number.isSafeInteger(order.qty) || order.qty < 1 || order.qty > 10000 ||
      typeof order.total !== 'number' || !Number.isFinite(order.total) || order.total < 0 || order.total > 1000000000 ||
      typeof order.paid !== 'boolean' || typeof order.delivered !== 'boolean' ||
      !validText(order.name, 200) || !order.name.trim() ||
      !validText(order.phone, 100) || !validText(order.date, 200) ||
      !validText(order.notes ?? '', 5000)) return null;
    orders.push({
      id: order.id, box: order.box, qty: order.qty, total: order.total,
      name: order.name, phone: order.phone, date: order.date,
      notes: order.notes ?? '', paid: order.paid, delivered: order.delivered
    });
  }
  return orders;
}

export default async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Usá POST para enviar el resumen.' }, { Allow: 'POST' });
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return reply(403, { error: 'El envío debe realizarse desde el panel de pedidos.' });
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply(415, { error: 'El resumen debe enviarse en formato JSON.' });
  }
  const requestId = request.headers.get('x-summary-request-id');
  if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return reply(400, { error: 'Identificador de envío inválido.' });
  }
  let payload;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 500000) return reply(413, { error: 'El resumen es demasiado grande para enviarlo.' });
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'No se pudo leer el resumen.' });
  }
  if (!payload || !Object.hasOwn(summaryTitles, payload.type)) return reply(400, { error: 'Tipo de resumen inválido.' });
  const orders = validateOrders(payload.orders);
  if (!orders) return reply(400, { error: 'Los pedidos contienen datos inválidos, están vacíos o superan el límite de 1000 pedidos por envío.' });
  const apiKey = Netlify.env.get('RESEND_API_KEY');
  if (!apiKey) return reply(503, { error: 'El envío de correo no está configurado. Falta RESEND_API_KEY en las variables secretas de Netlify.' });
  const from = Netlify.env.get('RESEND_FROM_EMAIL') || 'Delicias By Luisana <onboarding@resend.dev>';
  const summary = createSummary(orders, payload.type);
  const message = {
    from,
    to: ['cluisanaesther@gmail.com'],
    subject: `Delicias By Luisana — ${summary.title}`,
    text: `${summary.text}\n\nResumen de todos los pedidos guardados en el dispositivo desde el que se envió.`,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>.summary-metric{margin:10px 0;padding:10px;background:#f8eee5;border-radius:8px}.summary-metric span{display:block;font-size:13px}.summary-metric b{display:block;color:#790807}.card{margin:12px 0;padding:12px;border:1px solid #eadbd0;border-radius:8px;overflow-wrap:anywhere}.name,.total{font-weight:bold}.total{color:#790807}.meta{line-height:1.6}.price{color:#806d67}</style></head><body style="background:#fff8e9;color:#351b18;font-family:Arial,sans-serif;padding:20px"><h1>Delicias By Luisana</h1><h2>${escapeHtml(summary.title)}</h2>${summary.html}<p>Resumen de todos los pedidos guardados en el dispositivo desde el que se envió.</p></body></html>`
  };
  const contentHash = createHash('sha256').update(JSON.stringify({ type: payload.type, orders })).digest('hex');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `summary-${requestId}-${contentHash}`
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      if (response.status === 401) return reply(503, { error: 'Resend rechazó la configuración del correo. Revisá RESEND_API_KEY en Netlify.' });
      if (response.status === 403 || response.status === 422) return reply(503, { error: 'Resend no autorizó el envío. Verificá el remitente en Resend y configurá RESEND_FROM_EMAIL; el remitente de prueba solo permite enviar al correo de la cuenta de Resend.' });
      if (response.status === 429) return reply(429, { error: 'Se alcanzó el límite de envíos de Resend. Esperá antes de volver a intentar.' });
      return reply(502, { error: 'Resend no pudo procesar el correo. Intentá nuevamente.' });
    }
    const result = await response.json();
    if (!result?.id) return reply(502, { error: 'No se pudo confirmar el envío con Resend. Intentá nuevamente.' });
    return reply(200, { success: true });
  } catch {
    return reply(502, { error: 'No se pudo confirmar el envío. Revisá tu conexión y volvé a intentar.' });
  }
};

export const config: Config = {
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
