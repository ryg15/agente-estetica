export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const { tabla } = req.query;

  if (!['turnos', 'leads'].includes(tabla)) {
    return res.status(400).json({ error: 'Tabla inválida' });
  }

  const resp = await fetch(`${supabaseUrl}/rest/v1/${tabla}?order=created_at.desc`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  const data = await resp.json();
  res.status(200).json(data);
}
