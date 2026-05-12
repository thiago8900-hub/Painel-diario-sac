export default async function handler(req, res) {
  try {
    // 1. Tenta obter o Access Token (Usando .com.br)
    const tokenParams = new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    });

    const tokenResponse = await fetch(`https://accounts.zoho.com.br/oauth/v2/token?${tokenParams.toString()}`, {
      method: 'POST'
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(401).json({ 
        erro: "Token Inválido", 
        detalhes: "O Zoho não aceitou suas credenciais. Verifique o Refresh Token e se o Client ID é do servidor .com.br" 
      });
    }

    // 2. Busca a contagem de tickets (API v1)
    const response = await fetch(`https://desk.zoho.com.br/api/v1/ticketsCount`, {
      method: 'GET',
      headers: {
        'orgId': process.env.ZOHO_ORG_ID.trim(),
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ erro: "Erro na API do Zoho", detalhes: errorText });
    }

    const data = await response.json();
    
    // 3. Retorna os dados para o painel
    return res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    return res.status(500).json({ 
      erro: "Erro de conexão", 
      detalhes: error.message,
      ajuda: "Verifique se o seu Zoho é .com.br ou .com"
    });
  }
}
