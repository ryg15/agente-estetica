export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const emailDestino = process.env.ADMIN_EMAIL || 'ho14h014t@gmail.com';

  // Obtenemos los turnos de hoy
  const hoy = new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/New_York',
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const [turnosResp, leadsResp] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/turnos?order=hora.asc`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    }),
    fetch(`${supabaseUrl}/rest/v1/leads?order=created_at.desc`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
  ]);

  const turnos = await turnosResp.json();
  const leads = await leadsResp.json();

  // Filtramos leads de hoy
  const hoyDate = new Date().toISOString().split('T')[0];
  const leadsHoy = leads.filter(l => l.created_at && l.created_at.startsWith(hoyDate));

  // Armamos el HTML del mail
  const turnosHTML = turnos.length === 0
    ? '<p style="color:#9B7A87">No hay turnos registrados</p>'
    : turnos.map(t => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5">${t.hora || '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5;font-weight:500">${t.nombre || '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5">${t.tratamiento || '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5">${t.dia || '—'}</td>
        </tr>`).join('');

  const leadsHTML = leadsHoy.length === 0
    ? '<p style="color:#9B7A87">No hay leads nuevos hoy</p>'
    : leadsHoy.map(l => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5;font-weight:500">${l.nombre || '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5">${l.contacto || '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F0D9E5">${l.interes || '—'}</td>
        </tr>`).join('');

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#FDF6F9;padding:24px">
      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #F0D9E5">
        <div style="background:#D4537E;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:20px">✨ Glam Studio</h1>
          <p style="color:#FBEAF0;margin:6px 0 0;font-size:14px">Resumen del día — ${hoy}</p>
        </div>
        <div style="padding:24px">
          <h2 style="font-size:15px;color:#2D1B25;margin:0 0 12px">📅 Turnos totales (${turnos.length})</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#FDF6F9">
                <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Hora</th>
                <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Nombre</th>
                <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Tratamiento</th>
                <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Día</th>
              </tr>
            </thead>
            <tbody>${turnosHTML}</tbody>
          </table>

          <div style="margin-top:24px">
            <h2 style="font-size:15px;color:#2D1B25;margin:0 0 12px">👥 Leads nuevos hoy (${leadsHoy.length})</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:#FDF6F9">
                  <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Nombre</th>
                  <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Contacto</th>
                  <th style="text-align:left;padding:8px 14px;color:#9B7A87;font-weight:500">Interés</th>
                </tr>
              </thead>
              <tbody>${leadsHTML}</tbody>
            </table>
          </div>

          <div style="margin-top:24px;padding:16px;background:#FDF6F9;border-radius:10px;text-align:center">
            <p style="color:#9B7A87;font-size:12px;margin:0">Resumen generado automáticamente por Glam Studio Agente IA</p>
          </div>
        </div>
      </div>
    </div>`;

  // Enviamos el mail con Resend
  const mailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: 'Glam Studio <onboarding@resend.dev>',
      to: emailDestino,
      subject: `✨ Glam Studio — Resumen del día ${hoy}`,
      html: html
    })
  });

  const mailData = await mailResp.json();

  if (mailData.id) {
    res.status(200).json({ ok: true, message: 'Resumen enviado', id: mailData.id });
  } else {
    res.status(500).json({ ok: false, error: mailData });
  }
}
