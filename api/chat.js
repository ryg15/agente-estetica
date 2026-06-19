export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  const tools = [
    {
      name: 'guardar_turno',
      description: 'Guarda un turno agendado. Llamá cuando tengas nombre, tratamiento, día y hora confirmados.',
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
      system: `Sos el asistente virtual de Glam Studio, una estética premium en Buenos Aires.
Tu trabajo es:
1. Detectar el idioma en que escribe la clienta y responder siempre en ese mismo idioma
2. Responder consultas sobre tratamientos con calidez y profesionalismo
3. Ayudar a agendar turnos — preguntá nombre, tratamiento, día y hora preferidos
4. Cuando tengas todos los datos del turno, llamá a la herramienta guardar_turno
5. Cuando alguien pida promos o info, pedile nombre y contacto y llamá a guardar_lead
6. Recomendar tratamientos según lo que describe la clienta

Tratamientos disponibles:
- Limpieza facial profunda: $8.500 · 60min
- Hydrafacial premium: $12.000 · 75min
- Peeling vitamina C: $6.200 · 45min
- Peeling químico: $9.800 · 45min
- Drenaje linfático: $10.500 · 90min
- Masaje relajante: $8.000 · 60min
- Masaje con piedras calientes: $9.500 · 90min

Horarios: lunes a sábado 9:00 a 19:00.
Usá tono cálido y profesional. Usá saltos de línea para fácil lectura.`,
      messages: messages
    })
  });

  const data = await response.json();

  // Si el modelo usó una herramienta, guardamos en Supabase
  if (data.stop_reason === 'tool_use') {
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const table = block.name === 'guardar_turno' ? 'turnos' : 'leads';

        await fetch(`${supabaseUrl}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(block.input)
        });
      }
    }
  }

  res.status(200).json(data);
}
