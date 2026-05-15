// api/zoho.js — Versão Final, agora vai

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rt = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
  const ci = (process.env.ZOHO_CLIENT_ID     || '').trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || '').trim();
  const oi = (process.env.ZOHO_ORG_ID        || '').trim();
  const departmentId = process.env.ZOHO_DEPARTMENT_ID || '365059000000006907';

  try {
    // ── 1. Autenticação OAuth2 ──────────────────────────────────────────────
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: rt,
        client_id:     ci,
        client_secret: cs,
        grant_type:    'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ erro: 'Falha na autenticação OAuth2', detalhes: tokenData });
    }

    const headers = {
      Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
      orgId: oi,
    };

    // ── 2. Contar tickets Abertos (statusType=Open) ─────────────────────────
    // Usa limit=1 — só precisamos do campo "count" no header, não dos dados
    const [openRes, holdRes] = await Promise.all([
      fetch(
        `https://desk.zoho.com/api/v1/tickets?departmentId=${departmentId}&status=open&limit=1`,
        { headers }
      ),
      fetch(
        `https://desk.zoho.com/api/v1/tickets?departmentId=${departmentId}&status=onhold&limit=1`,
        { headers }
      ),
    ]);

    const openData = await openRes.json();
    const holdData = await holdRes.json();

    // O Zoho retorna o total no campo "count" fora do array "data"
    const totalAbertos   = parseInt(openData.count ?? openData.data?.length ?? 0);
    const totalAguardando = parseInt(holdData.count ?? holdData.data?.length ?? 0);

    // ── 3. Resposta final ───────────────────────────────────────────────────
    return res.status(200).json({
      totaisAbertoAguardando: totalAbertos + totalAguardando,
      somenteAbertos:         totalAbertos,
      somenteAguardando:      totalAguardando,
      atualizadoEm:           new Date().toISOString(),
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
