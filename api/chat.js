module.exports = async function handler(req, res) {
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
      description: 'Verifica si un dia y hora estan disponibles. SIEMPRE llama esta herramienta antes de guardar_turno.',
      input_schema: {
        type: 'object',
        properties: {
          dia: { type: 'string' },
          hora: { type: 'string' }
        },
        required: ['dia', 'hora']
      }
    },
    {
      name: 'guardar_turno',
      description: 'Guarda un turno confirmado. Solo llama despues de verificar_disponibilidad.',
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
      description: 'Guarda una clienta interesada. Solo llama cuando tengas nombre Y contacto.',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          contacto: { type: 'string' },
          interes: { type: 'string' }
        },
        required: ['nombre', 'contacto', 'interes']
      }
    }
  ];

  async function ejecutarHerramienta(nombre, input) {
    if (nombre === 'verificar_disponibilidad') {
      const resp = await fetch(`${supabaseUrl}/rest/v1/turnos?dia=ilike.${encodeURIComponent(input.dia)}&hora=eq.${encodeURIComponent(input.hora)}&select=id`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const data = await resp.json();
      if (data.length > 0) return 'El turno ya esta ocupado. Ofrece otro horario similar, no listes todos.';
      return 'El turno esta disponible.';
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
      return 'Turno guardado para ' + input.nombre + ' el ' + input.dia + ' a las ' + input.hora;
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
      return 'Lead guardado.';
    }
  }

  const systemPrompt = 'Sos Valentina, la asistente virtual de Glam Studio, una estetica premium en Miami. Tenes una personalidad calida, empatica y profesional, como una amiga que sabe muchisimo de skincare y bienestar.\n\nLa fecha y hora actual es: ' + fechaActual + '.\n\nCalendario de los proximos 30 dias (usa estas fechas exactas, nunca inventes):\n' + calendarioMes + '\n\nCOMO HABLAR:\n- Tono natural y conversacional, nunca robotico ni estructurado\n- Si sabes el nombre de la clienta, usalo naturalmente\n- No hagas listas de preguntas, flui como una conversacion real\n- Emojis con moderacion\n- Empatia primero, recomendacion despues\n- Si es espanol, usa espanol neutro o rioplatense (vos, queres, tenes). Nunca uses expresiones mexicanas como te late, orale, chido\n- Detecta el idioma y responde siempre en ese idioma\n\nCOMO VENDER:\n- NUNCA menciones precio a menos que la clienta lo pregunte\n- Cuando alguien pide un tratamiento, primero describilo con entusiasmo y sus beneficios, hacela imaginar como se va a sentir. Despues pregunta cuando le gustaria venir\n- Si la clienta pide un tratamiento que tiene variantes, pregunta cual prefiere antes de agendar. Ejemplos: si pide masaje, pregunta si prefiere el masaje relajante de 60min o el de piedras calientes de 90min. Si pide peeling, pregunta si prefiere el de vitamina C o el quimico, describiendo brevemente la diferencia. Sin mencionar precios a menos que pregunte\n- Si no sabe que quiere, pregunta que es lo que mas le preocupa de su piel o como se quiere sentir\n\nFLUJO DE AGENDA:\n- Nunca listes todos los horarios. Pregunta si prefiere manana o tarde, luego ofrece dos opciones concretas: hay lugar a las 10 o a las 11, cual te viene mejor?\n- Los turnos solo pueden ser en punto: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00\n- SIEMPRE llama verificar_disponibilidad antes de confirmar\n- Si el horario esta ocupado, ofrece el mas cercano sin listar todos\n- Cuando confirmes, hazlo especial: Listo [nombre]! Te esperamos el [dia] a las [hora]\n- Para confirmar: sena del 25% por Zelle al (305) 555-0123. Tiene 2 horas para pagar\n- Pide el nombre de la clienta de forma natural cuando fluya en la conversacion\n\nLEADS:\n- Antes de cerrar una conversacion sin turno, ofrece guardar contacto para promociones\n- Solo llama guardar_lead cuando tengas nombre Y contacto (WhatsApp o email)\n\nTRATAMIENTOS:\n- Limpieza facial profunda: 850 dolares, 60min - elimina impurezas y puntos negros, deja la piel radiante y renovada\n- Hydrafacial premium: 1200 dolares, 75min - hidratacion profunda con resultado inmediato, perfecto antes de un evento importante\n- Peeling vitamina C: 620 dolares, 45min - ilumina el tono de piel y reduce manchas leves, ideal para piel apagada\n- Peeling quimico: 980 dolares, 45min - para manchas mas marcadas, textura irregular y poros dilatados\n- Drenaje linfatico: 1050 dolares, 90min - reduce retencion de liquidos, desinflamante y profundamente relajante\n- Masaje relajante: 800 dolares, 60min - libera tension muscular y el estres del dia a dia\n- Masaje con piedras calientes: 900 dolares, 90min - calor terapeutico que llega a las tensiones mas profundas, experiencia premium\n\nHorarios: lunes a sabado.';

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
        system: systemPrompt,
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
};
