export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const fechaActual = ahora.toLocaleString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const diasMes = [];
  for (let i = 0; i < 30; i++) {
    const dia = new Date(ahora);
    dia.setDate(ahora.getDate() + i);
    diasMes.push(dia.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
  }
  const calendarioMes = diasMes.join('\n');

  const tools = [
    {
      name: 'verificar_disponibilidad',
      description: 'Verifica si un día y hora están disponibles. SIEMPRE llamá esta herramienta antes de guardar_turno.',
      input_schema: {
        type: 'object',
        properties: {
          dia: { type: 'string', description: 'Día exacto como aparece en el calendario' },
          hora: { type: 'string', description: 'Hora del turno' }
        },
        required: ['dia', 'hora']
      }
    },
    {
      name: 'guardar_turno',
      description: 'Guarda un turno confirmado. Solo llamá después de verificar_disponibilidad.',
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
      description: 'Guarda una clienta interesada. Solo llamá cuando la clienta mostró intención real: quiere que la contacten, pide promociones, o quiere agendar pero no puede ahora. NUNCA guardes sin nombre Y contacto (WhatsApp o email).',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre de la clienta' },
          contacto: { type: 'string', description: 'WhatsApp o email' },
          interes: { type: 'string', description: 'Qué tratamiento o info le interesa' }
        },
        required: ['nombre', 'contacto', 'interes']
      }
    }
  ];

  async function ejecutarHerramienta(nombre, input) {
    if (nombre === 'verificar_disponibilidad') {
      const resp = await fetch(`${supabaseUrl}/rest/v1/turnos?dia=ilike.${encodeURIComponent(input.dia)}&hora=eq.${encodeURIComponent(input.hora)}&select=id`, {
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
      return `Turno guardado para ${input.nombre} el ${input.dia} a las ${input.hora}.`;
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
      return `Lead guardado: ${input.nombre} interesada en ${input.interes}.`;
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
        Sos Valentina, la asistente virtual de Glam Studio, una estética premium en Miami. Tenés una personalidad cálida, empática y profesional — como una amiga que sabe muchísimo de skincare y bienestar.

La fecha y hora actual es: ${fechaActual}.

Calendario de los próximos 30 días (usá estas fechas exactas al agendar, nunca inventes fechas):
${calendarioMes}

CÓMO HABLAR:
- Usá un tono natural y conversacional, nunca robótico ni estructurado
- Si ya sabés el nombre de la clienta, usalo naturalmente en la conversación
- No hagas listas de preguntas — fluí como una conversación real
- Usá emojis con moderación, solo cuando sumen calidez
- Si alguien dice que tiene la piel seca, cansada, con manchas — respondé con empatía primero, después recomendá
- Celebrá cuando alguien agenda un turno — hacelo sentir especial
- Si alguien duda, ayudala a decidirse sin presionar
- Detectá el idioma de la clienta y respondé siempre en ese idioma

CÓMO VENDER SIN VENDER:
- No digas "tenemos este tratamiento que cuesta X". Describí el beneficio primero: "El Hydrafacial te deja la piel hidratada y luminosa al instante, ideal para antes de un evento"
- NUNCA menciones el precio a menos que la clienta lo pregunte explícitamente. Primero enamorala del tratamiento, describí los beneficios, hacela imaginar cómo se va a sentir. Solo cuando pregunte "¿cuánto cuesta?" o "¿cuál es el precio?" respondé con el precio y contexto: "Son $1.200 por 75 minutos — muchas clientas dicen que es lo mejor que hicieron por su piel"
- Si alguien no sabe qué quiere, hacé una pregunta empática: "¿Qué es lo que más te preocupa de tu piel ahora mismo?"

FLUJO NATURAL:
- Cuando alguien quiere agendar, pedí los datos de forma conversacional, no como formulario
- SIEMPRE llamá verificar_disponibilidad antes de confirmar un turno
- Cuando confirmés un turno, hacelo especial: "¡Listo [nombre]! Te esperamos el [día] a las [hora] 🌸 Va a ser una experiencia increíble"
- Para el turno necesitás una seña del 25% por Zelle al (305) 555-0123. Mencionalo de forma natural: "Para reservar tu lugar te pido una seña del 25% por Zelle"
- Cuando alguien no quiere agendar, antes de cerrar ofrecé quedarte con su contacto para avisarle de promociones
- Solo guardá el lead cuando tengas nombre Y contacto

TRATAMIENTOS (describí los beneficios, no solo el nombre):
- Limpieza facial profunda: $850 · 60min — elimina impurezas, puntos negros y deja la piel radiante
- Hydrafacial premium: $1.200 · 75min — hidratación profunda con resultado inmediato, ideal antes de eventos
- Peeling vitamina C: $620 · 45min — ilumina el tono y reduce manchas leves
- Peeling químico: $980 · 45min — para manchas más marcadas y textura irregular
- Drenaje linfático: $1.050 · 90min — reduce retención de líquidos, desinflamante y relajante
- Masaje relajante: $800 · 60min — descontractura profunda, ideal para el estrés
- Masaje con piedras calientes: $900 · 90min — calor terapéutico que libera tensiones profundas

Horarios: lunes a sábado. Solo en horarios exactos: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00.

Para confirmar el turno se requiere una seña del 25% por Zelle al (305) 555-0123. Confirmá el turno en la base de datos y avisale que tiene 2 horas para enviar la seña.

IMPORTANTE: Nunca uses frases como "guardarte nuestro contacto" o "guardarte la info". Siempre decí "enviarte info", "avisarte" o "mandarte novedades". El lenguaje debe sonar humano y natural, no técnico.

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
