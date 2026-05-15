// api/zoho.js
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
    // 1. Autenticação OAuth2
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: rt,
        client_id: ci,
        client_secret: cs,
        grant_type: 'refresh_token',
      }),
    });

    // Verificação de erro no Token antes de dar .json()
    if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        return res.status(401).json({ erro: 'Erro na autenticação Zoho', detalhes: errorText });
    }

    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
      return res.status(401).json({ erro: 'Access Token não recebido', detalhes: tokenData });
    }

    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`,
      'orgId': oi, // Verifique se esta variável não está vazia no seu .env
    };

    // 2. Busca de Tickets com tratamento de resposta
    const fetchZoho = async (status) => {
        const response = await fetch(
            `https://desk.zoho.com/api/v1/tickets?departmentId=${departmentId}&status=${status}&limit=1`,
            { headers }
        );
        
        // Se a resposta for vazia ou erro, retorna objeto seguro
        if (!response.ok || response.status === 204) return { count: 0, data: [] };
        
        try {
            return await response.json();
        } catch (e) {
            return { count: 0, data: [] };
        }
    };

    const [openData, holdData] = await Promise.all([
      fetchZoho('open'),
      fetchZoho('onhold')
    ]);

    // O Zoho retorna o total no campo "count"
    const totalAbertos    = parseInt(openData.count ?? openData.data?.length ?? 0);
    const totalAguardando = parseInt(holdData.count ?? holdData.data?.length ?? 0);

    return res.status(200).json({
      totaisAbertoAguardando: totalAbertos + totalAguardando,
      somenteAbertos:         totalAbertos,
      somenteAguardando:      totalAguardando,
      atualizadoEm:           new Date().toISOString(),
    });

  } catch (error) {
    return res.status(500).json({ erro: "Erro interno no servidor", mensagem: error.message });
  }
}
