export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const fechaActual = new Date().toLocaleString('es-AR', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const tools = [
    {
      name: 'verificar_disponibilidad',
      description: 'Verifica si un día y hora están disponibles antes de confirmar un turno. Siempre llamá esta herramienta antes de guardar_turno.',
      input_schema: {
        type: 'object',
        properties: {
          dia: { type: 'string', description: 'Día del turno' },
          hora: { type: 'string', description: 'Hora del turno' }
        },
        required: ['dia', 'hora']
      }
    },
    {
      name: 'guardar_turno',
      description: 'Guarda un turno confirmado. Solo llamá esta herramienta después de verificar_disponibilidad y confirmar que está libre.',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          tratamiento: { type: 'string' },
          dia: { type: 'string' },
          hora: { type: 'string' },
          canal: { type: 'string' }
        },
        required: ['nombre', 'tratamiento', 'dia', 'hora']
      }
    },
    {
      name: 'guardar_lead',
      description: 'Guarda una clienta interesada en promos o info.',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          contacto: { type: 'string' },
          interes: { type: 'string' }
        },
        required: ['interes']
      }
    }
  ];

  async function ejecutarHerramienta(nombre, input) {
    if (nombre === 'verificar_disponibilidad') {
      const resp = await fetch(`${supabaseUrl}/rest/v1/turnos?dia=eq.${encodeURIComponent(input.dia)}&hora=eq.${encodeURIComponent(input.hora)}&select=id`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const data = await resp.json();
      if (data.length > 0) {
        return `El turno del ${input.dia} a las ${input.hora} ya está ocupado. Ofrecé otro horario disponible.`;
      }
      return `El turno del ${input.dia} a las ${input.hora} está disponible.`;
    }

    if (nombre === 'guardar_turno') {
      await fetch(`${supabaseUrl}/rest/v1/turnos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(input)
      });
      return `Turno guardado correctamente para ${input.nombre} el ${input.dia} a las ${input.hora}.`;
    }

    if (nombre === 'guardar_lead') {
      await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(input)
      });
      return `Lead guardado correctamente.`;
    }
  }

  let historial = [...messages];

  while (true) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        tools: tools,
        system: `Sos el asistente virtual de Glam Studio, una estética premium en Miami.
La fecha y hora actual es: ${fechaActual}.

Tu trabajo es:
1. Detectar el idioma en que escribe la clienta y responder siempre en ese mismo idioma
2. Responder consultas sobre tratamientos con calidez y profesionalismo
3. Ayudar a agendar turnos — preguntá nombre, tratamiento, día y hora preferidos
4. SIEMPRE llamá verificar_disponibilidad antes de confirmar un turno
5. Si el horario está ocupado, ofrecé alternativas cercanas
6. Cuando el horario esté libre y tengas todos los datos, llamá guardar_turno
7. Cuando alguien pida promos o info, pedile nombre y contacto y llamá guardar_lead
8. Recomendar tratamientos según lo que describe la clienta

Tratamientos disponibles:
- Limpieza facial profunda: $850 · 60min
- Hydrafacial premium: $1.200 · 75min
- Peeling vitamina C: $620 · 45min
- Peeling químico: $980 · 45min
- Drenaje linfático: $1.050 · 90min
- Masaje relajante: $800 · 60min
- Masaje con piedras calientes: $950 · 90min

Horarios: lunes a sábado 9:00 a 19:00.
Usá tono cálido y profesional. Usá saltos de línea para fácil lectura.`,
        messages: historial
      })
    });

    const data = await response.json();

    if (data.stop_reason !== 'tool_use') {
      return res.status(200).json(data);
    }

    historial.push({ role: 'assistant', content: data.content });

    const resultados = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const output = await ejecutarHerramienta(block.name, block.input);
        resultados.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output
        });
      }
    }

    historial.push({ role: 'user', content: resultados });
  }
}
