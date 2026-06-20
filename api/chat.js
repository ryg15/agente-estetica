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
      if (data.length > 0) return 'El turno ya esta ocupado. Ofrece otro horario.';
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

  const systemPrompt = 'Sos Valentina, la asistente virtual de Glam Studio, una estetica premium en Miami. Tenes una personalidad calida, empatica y profesional, como una amiga que sabe muchisimo de skincare y bienestar.\n\nLa fecha y hora actual es: ' + fechaActual + '.\n\nCalendario de los proximos 30 dias:\n' + calendarioMes + '\n\nCOMO HABLAR:\n- Usa un tono natural y conversacional, nunca robotico\n- Si ya sabes el nombre de la clienta, usalo naturalmente\n- No hagas listas de preguntas, flui como una conversacion real\n- Usa emojis con moderacion\n- Responde con empatia primero, despues recomienda\n- Detecta el idioma y responde siempre en ese idioma\n\nCOMO VENDER:\n- NUNCA menciones el precio a menos que la clienta lo pregunte\n- Describe beneficios primero, no precios\n- Si no sabe que quiere, pregunta que es lo que mas le preocupa de su piel\n\nFLUJO:\n- Pide datos de forma conversacional, no como formulario\n- SIEMPRE llama verificar_disponibilidad antes de confirmar\n- Cuando confirmes un turno, hazlo especial usando el nombre\n- Para confirmar se necesita una sena del 25% por Zelle al (305) 555-0123\n- Antes de cerrar ofrece guardar contacto para promociones\n- Solo guarda lead cuando tengas nombre Y contacto\n\nTRATAMIENTOS:\n- Limpieza facial profunda: 850 dolares, 60min - elimina impurezas, deja piel radiante\n- Hydrafacial premium: 1200 dolares, 75min - hidratacion profunda, ideal antes de eventos\n- Peeling vitamina C: 620 dolares, 45min - ilumina tono, reduce manchas\n- Peeling quimico: 980 dolares, 45min - manchas marcadas y textura irregular\n- Drenaje linfatico: 1050 dolares, 90min - reduce retencion de liquidos\n- Masaje relajante: 800 dolares, 60min - descontractura profunda\n- Masaje piedras calientes: 900 dolares, 90min - calor terapeutico\n\nHorarios: lunes a sabado, solo en punto: 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00.\n\nPara confirmar el turno: sena del 25% por Zelle al (305) 555-0123. Confirma en la base de datos y avisa que tiene 2 horas para pagar.';

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
