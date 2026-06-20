module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const emailDestino = process.env.ADMIN_EMAIL;

  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const horaProxima = ahora.getHours() + 1;
  const horaProximaStr = horaProxima.toString().padStart(2, '0') + ':00';

  const diaHoy = ahora.toLocaleString('es-AR', {
    timeZone: 'America/New_York',
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).toLowerCase();

  const turnosResp = await fetch(`${supabaseUrl}/rest/v1/turnos?hora=eq.${encodeURIComponent(horaProximaStr)}&select=*`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  const todosTurnos = await turnosResp.json();

  const turnos = todosTurnos.filter(t => {
    if (!t.dia) return false;
    const diasTurno = t.dia.toLowerCase();
    const partes = diaHoy.split(' ').filter(p => p.length > 2);
    return partes.some(parte => diasTurno.includes(parte));
  });

  if (turnos.length === 0) {
    return res.status(200).json({ ok: true, message: 'No hay turnos en la proxima hora', hora: horaProximaStr, diaHoy });
  }

  const turnosHTML = turnos.map(t => `
    <div style="background:#FDF6F9;border-radius:10px;padding:16px;margin-bottom:12px;border-left:4px solid #D4537E">
      <p style="margin:0;font-size:16px;font-weight:600;color:#2D1B25">⏰ ${t.hora} — ${t.nombre}</p>
      <p style="margin:6px 0 0;font-size:14px;color:#9B7A87">${t.tratamiento} · ${t.dia}</p>
    </div>`).join('');

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#FDF6F9;padding:24px">
      <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #F0D9E5">
        <div style="background:#D4537E;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:20px">⏰ Recordatorio de turnos</h1>
          <p style="color:#FBEAF0;margin:6px 0 0;font-size:14px">Turnos en aproximadamente 1 hora — ${horaProximaStr}</p>
        </div>
        <div style="padding:24px">
          ${turnosHTML}
          <p style="font-size:13px;color:#9B7A87;margin-top:16px;text-align:center">
            Acordate de confirmar con las clientas si es necesario.
          </p>
        </div>
      </div>
    </div>`;

  const mailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: 'Glam Studio <onboarding@resend.dev>',
      to: emailDestino,
      subject: `⏰ Recordatorio — Turnos a las ${horaProximaStr}`,
      html: html
    })
  });

  const mailData = await mailResp.json();

  if (mailData.id) {
    res.status(200).json({ ok: true, message: `Recordatorio enviado para ${turnos.length} turno(s) a las ${horaProximaStr}`, turnos: turnos.length });
  } else {
    res.status(500).json({ ok: false, error: mailData });
  }
};
