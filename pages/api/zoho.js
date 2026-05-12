export default async function handler(req, res) {
  try {
    // 1. Pega o Access Token no servidor Brasileiro
    const tokenResponse = await fetch(`https://accounts.zoho.com.br/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, {
      method: 'POST'
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(401).json({ 
        erro: "Token Inválido", 
        debug: tokenData 
      });
    }

    // 2. Busca os dados no Desk Brasileiro
    const response = await fetch(`https://desk.zoho.com.br/api/v1/ticketsCount`, {
      headers: {
        'orgId': process.env.ZOHO_ORG_ID,
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    const data = await response.json();
    
    // 3. Entrega os números para o Painel
    res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro de conexão", detalhes: error.message });
  }
}
