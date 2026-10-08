# Delicias By Luisana

El panel conserva los pedidos en `localStorage`, con la clave original `delicias_orders`. No se migraron ni se modificaron los pedidos existentes. Las tres páginas del proyecto ofrecen las mismas funcionalidades.

## Resúmenes

La sección **📊 Resúmenes** permite ver el resumen general, ventas y cobros, pendientes de cobro y entrega, y el detalle completo. Se actualiza al agregar, editar, eliminar, cobrar o entregar un pedido. Incluye todos los boxes, independientemente del box seleccionado o de la búsqueda. Los cobros siguen el estado de pago completo del pedido; no se introdujeron pagos parciales.

El botón **📧 Enviar a mi Gmail** envía únicamente el resumen seleccionado a **cluisanaesther@gmail.com**. Usa los pedidos guardados en el dispositivo actual. No requiere ingresar un correo, no cambia los pedidos y queda deshabilitado si no hay pedidos.

## Configuración de correo en Netlify

1. Configurá `RESEND_API_KEY` como variable secreta de Netlify disponible para Functions en los contextos de despliegue donde uses el envío. No la agregues a archivos del repositorio ni a variables públicas del navegador.
2. El remitente predeterminado es `Delicias By Luisana <onboarding@resend.dev>`. El dominio de prueba de Resend solo permite enviar al correo de la cuenta de Resend: funciona si esa cuenta pertenece a **cluisanaesther@gmail.com**.
3. Si la cuenta de Resend tiene otro correo o necesitás un remitente de producción, verificá un dominio en Resend y configurá `RESEND_FROM_EMAIL` en Netlify con una dirección de ese dominio, por ejemplo `Delicias By Luisana <pedidos@tu-dominio-verificado.com>`. No uses una dirección Gmail como remitente verificado.
4. Volvé a desplegar el sitio después de configurar las variables y probá el botón desde el sitio HTTPS publicado. Si Resend acepta el correo pero no aparece en la bandeja de entrada, revisá spam y el estado del envío en Resend.

La función `netlify/functions/send-summary.mts`, disponible en `/.netlify/functions/send-summary`, lee la clave solo del entorno del servidor. Valida los pedidos, fija el destinatario en el servidor, escapa los textos y genera el mismo resumen que se muestra en el panel. No acepta HTML ni destinatarios proporcionados por el navegador. Devuelve errores sin exponer respuestas internas de Resend ni credenciales.

Se limitan los envíos a cinco solicitudes por minuto e IP/dominio y a 1000 pedidos por envío. Los reintentos de un envío sin confirmación reutilizan una clave de idempotencia para evitar correos duplicados. La comprobación de origen y estos límites reducen el abuso; no sustituyen autenticación. El panel continúa sin login, como el sitio original.
