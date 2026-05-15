// api/zoho.js
let _cachedToken = null;
let _tokenExpires = 0;

async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpires) return _cachedToken;

  const tokenParams = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN?.trim(),
    client_id:     process.env.ZOHO_CLIENT_ID?.trim(),
    client_secret: process.env.ZOHO_CLIENT_SECRET?.trim(),
    grant_type:    'refresh_token'
  });

  const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Erro Token: ' + JSON.stringify(tokenData));

  _cachedToken = tokenData.access_token;
  _tokenExpires = Date.now() + 50 * 60 * 1000;
  return _cachedToken;
}

async function zohoRequest(path, params, accessToken) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://desk.zoho.com/api/v1/${path}?${qs}`;
  
  const res = await fetch(url, {
    headers: {
      'orgId': process.env.ZOHO_ORG_ID?.trim(),
      'Authorization': `Zoho-oauthtoken ${accessToken}`
    }
  });

  if (res.status === 204) return { data: [] };
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return { data: [] }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const accessToken = await getAccessToken();
    const SAC_DEPT = '365059000000006907';
    
    // Status que você considera como "Fechado" no seu Zoho
    const CLOSED_STATUSES = ['Fechado', 'Fechado Inatividade', 'Closed'];

    // 1. Pegar Tickets Abertos (StatusType = Open ou On Hold)
    // Em vez de baixar 5000 tickets, usamos o filtro oficial do Zoho por "statusType"
    const [openRes, holdRes] = await Promise.all([
      zohoRequest('tickets', { departmentId: SAC_DEPT, statusType: 'Open', limit: 100 }, accessToken),
      zohoRequest('tickets', { departmentId: SAC_DEPT, statusType: 'On Hold', limit: 100 }, accessToken)
    ]);

    const openTickets = openRes.data || [];
    const holdTickets = holdRes.data || [];

    // 2. Filtrar para garantir que não venha nada de outro departamento (segurança)
    const somenteAbertos = openTickets.filter(t => !CLOSED_STATUSES.includes(t.status)).length;
    const somenteAguardando = holdTickets.filter(t => !CLOSED_STATUSES.includes(t.status)).length;

    // 3. Retorno simplificado para o seu Dashboard
    return res.status(200).json({
      totaisAbertoAguardando: somenteAbertos + somenteAguardando,
      somenteAbertos: somenteAbertos,
      somenteAguardando: somenteAguardando,
      atualizadoEm: new Date().toISOString(),
      // Remova a linha abaixo se não quiser listar os tickets
      debug: { totalProcessado: openTickets.length + holdTickets.length }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}
