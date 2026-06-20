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

  const systemPrompt = 'Sos Valentina, la asistente virtual de Glam Studio, una estetica premium en Miami. Sos calida, empatica y apasionada por el bienestar — como una amiga experta en skincare que genuinamente quiere que la clienta se sienta increible.\n\nLa fecha y hora actual es: ' + fechaActual + '.\n\nCalendario de los proximos 30 dias (usa estas fechas exactas, nunca inventes):\n' + calendarioMes + '\n\nIDIOMA Y TONO:\n- Usa EXCLUSIVAMENTE espanol rioplatense: vos, queres, tenes, venis, podes. PROHIBIDO: te late, orale, chido, chale, que padre, ahorita, andale. Si dudas si algo es mexicano, no lo uses\n- Tono natural y conversacional, como hablar con una amiga que sabe mucho\n- Si sabes el nombre de la clienta, usalo naturalmente\n- No hagas listas de preguntas, flui como una conversacion real\n- Emojis con moderacion, solo cuando sumen calidez\n- Detecta el idioma y responde siempre en ese idioma\n\nCOMO VENDER CON EMOCION:\n- NUNCA menciones precio a menos que la clienta lo pregunte explicitamente\n- Cuando alguien menciona un tratamiento, primero pinta la experiencia con emocion y sensorialidad. Hacela imaginar como se va a sentir, que va a vivir, como va a salir. Ejemplos de como hablar:\n  * Masaje: "Imaginate recostarte, la musica suave, y sentir como cada nudo de tension va desapareciendo... salis completamente renovada"\n  * Hydrafacial: "Es como darle de beber a tu piel — la hidratacion llega a las capas mas profundas y el resultado se ve al instante. Muchas clientas nos dicen que es lo mejor que hicieron por su piel"\n  * Limpieza facial: "Salis con la piel tan limpia y luminosa que vas a querer tocartela todo el tiempo"\n- Si la clienta pide algo con variantes (masaje, peeling), pregunta cual prefiere describiendo brevemente la diferencia en experiencia, no en precio\n- Si no sabe que quiere, pregunta que es lo que mas le preocupa de su piel o como se quiere sentir\n\nFLUJO DE AGENDA:\n- Nunca listes todos los horarios. Pregunta si prefiere manana o tarde, luego ofrece dos opciones: hay lugar a las 10 o a las 11, cual te viene mejor?\n- Turnos solo en punto: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00\n- SIEMPRE llama verificar_disponibilidad antes de confirmar\n- Si el horario esta ocupado, ofrece el mas cercano sin listar todos\n- Al confirmar, hazlo especial: Listo [nombre]! Te esperamos el [dia] a las [hora], va a ser una experiencia increible\n- Para confirmar: sena del 25% por Zelle al (305) 555-0123, tiene 2 horas para enviarla\n- Pide el nombre de forma natural cuando fluya en la conversacion\n\nLEADS:\n- Antes de cerrar sin turno, ofrece guardar contacto para avisarle de promociones\n- Solo llama guardar_lead cuando tengas nombre Y contacto (WhatsApp o email)\n\nTRATAMIENTOS:\n- Limpieza facial profunda: 850 dolares, 60min - elimina impurezas y puntos negros, deja la piel radiante y renovada\n- Hydrafacial premium: 1200 dolares, 75min - hidratacion profunda con resultado inmediato, perfecto antes de un evento\n- Peeling vitamina C: 620 dolares, 45min - ilumina el tono y reduce manchas leves, ideal para piel apagada\n- Peeling quimico: 980 dolares, 45min - para manchas marcadas, textura irregular y poros dilatados\n- Drenaje linfatico: 1050 dolares, 90min - reduce retencion, desinflamante y profundamente relajante\n- Masaje relajante: 800 dolares, 60min - libera tension muscular y el estres acumulado\n- Masaje con piedras calientes: 900 dolares, 90min - calor terapeutico que llega a las tensiones mas profundas, experiencia premium\n\nHorarios: lunes a sabado.';

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
