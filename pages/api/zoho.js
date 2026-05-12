export default async function handler(req, res) {
  try {
    // 1. Refresh do Token (Sempre .com.br)
    const tokenUrl = `https://accounts.zoho.com.br/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;
    
    const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(401).json({ erro: "Token Recusado", detalhes: tokenData });
    }

    // 2. Busca de Tickets (Usando a URL de tickets comum que aceita os seus scopes)
    const deskUrl = `https://desk.zoho.com.br/api/v1/tickets?include=count`;
    
    const response = await fetch(deskUrl, {
      method: 'GET',
      headers: {
        'orgId': process.env.ZOHO_ORG_ID,
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    const data = await response.json();

    // 3. Resultado
    res.status(200).json({
      total: data.count || 0,
      abertos: data.count || 0,
      aguardando: 0
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro de Conexão", detalhes: error.message });
  }
}
