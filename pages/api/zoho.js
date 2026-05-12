export default async function handler(req, res) {
  try {
    // 1. Pega um Token novo
    const tokenResponse = await fetch(`https://accounts.zoho.com.br/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, {
      method: 'POST'
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(500).json({ erro: "Falha no Token. Verifique suas chaves no Vercel." });
    }

    const accessToken = tokenData.access_token;

    // 2. Busca a contagem de tickets (Servidor .com.br)
    const response = await fetch(`https://desk.zoho.com.br/api/v1/tickets?include=count`, {
      headers: {
        'orgId': process.env.ZOHO_ORG_ID,
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });

    const data = await response.json();
    
    // 3. Devolve os dados
    res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro de conexão", detalhes: error.message });
  }
}
