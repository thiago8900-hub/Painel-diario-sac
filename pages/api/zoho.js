let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  // Pega as variáveis e garante que elas existem antes de tentar limpar espaços
  const rt = process.env.ZOHO_REFRESH_TOKEN || "";
  const ci = process.env.ZOHO_CLIENT_ID || "";
  const cs = process.env.ZOHO_CLIENT_SECRET || "";
  const oi = process.env.ZOHO_ORG_ID || "";

  if (!rt || !ci || !cs || !oi) {
    return res.status(500).json({ 
      etapa: "Configuração", 
      mensagem: "Uma das variáveis (Token, ID, Secret ou OrgID) não foi encontrada na Vercel." 
    });
  }

  try {
    if (!cachedToken || Date.now() > tokenExpiry) {
      const tokenResponse = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
        method: 'POST',
        body: new URLSearchParams({
          refresh_token: rt.trim(),
          client_id: ci.trim(),
          client_secret: cs.trim(),
          grant_type: 'refresh_token'
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        return res.status(401).json({ etapa: "Erro no Token", resposta: tokenData });
      }

      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3000000;
    }

    const deskResponse = await fetch(`https://desk.zoho.com.br/api/v1/ticketsCount`, {
      headers: {
        'orgId': oi.trim(),
        'Authorization': `Zoho-oauthtoken ${cachedToken}`
      }
    });

    const data = await deskResponse.json();
    res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    res.status(500).json({ etapa: "Falha Geral", mensagem: error.message });
  }
}
