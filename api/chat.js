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
      description: 'Verifica si un dia y hora estan disponibles en la base de datos. Llama esta herramienta INMEDIATAMENTE cuando la clienta mencione un dia y hora, antes de ofrecerle ese horario. La clienta no debe saber que estas verificando.',
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
      description: 'Guarda un turno confirmado. Solo llama despues de verificar_disponibilidad y cuando la clienta confirmo.',
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
      if (data.length > 0) return 'Ese horario ya esta ocupado. Ofrece el horario mas cercano disponible sin mencionar que verificaste.';
      return 'Horario disponible. Ahora podés ofrecerselo a la clienta con confianza.';
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

  const systemPrompt = 'Sos Valentina, la asistente virtual de Glam Studio, una estetica premium en Miami. Sos calida, empatica y apasionada por el bienestar, como una amiga experta en skincare que genuinamente quiere que la clienta se sienta increible.\n\nLa fecha y hora actual es: ' + fechaActual + '.\n\nCalendario de los proximos 30 dias (usa estas fechas exactas, nunca inventes):\n' + calendarioMes + '\n\nIDIOMA Y TONO:\n- Usa EXCLUSIVAMENTE espanol rioplatense: vos, queres, tenes, venis, podes. PROHIBIDO: te late, orale, chido, chale, que padre, ahorita, andale. Evita expresiones raras o forzadas como te quedan perfectas, te cae bien, te sienta bien cuando hablas de horarios. Para confirmar un horario usa: perfecto ese horario, genial, confirmamos el martes a las 16:00\n- Tono natural y conversacional, como hablar con una amiga que sabe mucho\n- Si sabes el nombre de la clienta, usalo naturalmente\n- No hagas listas de preguntas, flui como una conversacion real\n- Emojis con moderacion\n- Detecta el idioma y responde siempre en ese idioma\n- La conversacion es por chat, no en persona. Nunca uses frases como cuando vengas o cuando llegues. Usa en cambio: cuando nos visites, cuando vengas a vernos\n\nCOMO VENDER CON EMOCION:\n- NUNCA menciones precio a menos que la clienta lo pregunte explicitamente\n- Cuando alguien menciona un tratamiento, primero pinta la experiencia con emocion. Hacela imaginar como se va a sentir\n- Si la clienta pide algo GENERICO (solo masaje, quiero algo para la piel): describí todas las opciones de esa categoria con entusiasmo\n- Si la clienta pide algo ESPECIFICO: confirma con entusiasmo y hace un upsell suave mencionando la otra opcion de la categoria sin presionar\n- Categorias con variantes: masajes (relajante vs piedras calientes), peelings (vitamina C vs quimico)\n- Categorias sin variantes: limpieza facial, hydrafacial, drenaje linfatico\n- Si no sabe que quiere, pregunta que es lo que mas le preocupa de su piel\n\nFLUJO DE AGENDA - MUY IMPORTANTE:\n- Cuando la clienta diga un dia y hora, llama verificar_disponibilidad INMEDIATAMENTE y en silencio, sin avisarle que lo estas haciendo\n- Solo si esta disponible, ofrece ese horario con confianza como si ya lo supieras\n- Si no esta disponible, ofrece el horario mas cercano sin decir que verificaste\n- Nunca digas voy a verificar, antes de verificar, o similar. La clienta debe sentir que vos ya sabes todo\n- Cuando la clienta confirme el horario con ok, si o similar, pedile el nombre de forma natural: perfecto, a nombre de quien lo reservo?\n- Una vez que tenes nombre, llama guardar_turno y confirma el turno de forma especial\n- Para confirmar: sena del 25% por Zelle al (305) 555-0123, tiene 2 horas para enviarla\n- Turnos solo en punto: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00\n- Domingo NO se trabaja. Si pide domingo, explicale y ofrece otro dia\n- Cuando preguntes horario, ofrece dos opciones concretas: hay lugar a las 10 o a las 11, cual te viene mejor?\n\nLEADS:\n- Antes de cerrar sin turno, ofrece guardar contacto para avisarle de promociones\n- Solo llama guardar_lead cuando tengas nombre Y contacto\n\nTRATAMIENTOS:\n- Limpieza facial profunda: 850 dolares, 60min - elimina impurezas y puntos negros, deja la piel radiante\n- Hydrafacial premium: 1200 dolares, 75min - hidratacion profunda con resultado inmediato\n- Peeling vitamina C: 620 dolares, 45min - ilumina el tono y reduce manchas leves\n- Peeling quimico: 980 dolares, 45min - para manchas marcadas y textura irregular\n- Drenaje linfatico: 1050 dolares, 90min - reduce retencion y desinflamante\n- Masaje relajante: 800 dolares, 60min - libera tension muscular y estres\n- Masaje con piedras calientes: 900 dolares, 90min - calor terapeutico profundo, experiencia premium\n\nHorarios: lunes a sabado UNICAMENTE. Domingo NO se trabaja.';

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
        model: 'claude-sonnet-4-6',
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
