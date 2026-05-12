export default async function handler(req, res) {
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN);
    params.append('client_id', process.env.ZOHO_CLIENT_ID);
    params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');

    // 1. Pega o Token (Sempre .com.br para você)
    const tokenResponse = await fetch(`https://accounts.zoho.com.br/oauth/v2/token`, {
      method: 'POST',
      body: params
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(401).json({ erro: "Zoho recusou o Token", detalhes: tokenData });
    }

    // 2. Busca os dados (Usando a URL que aceita quase qualquer scope de tickets)
    const response = await fetch(`https://desk.zoho.com.br/api/v1/tickets?include=count`, {
      headers: {
        'orgId': process.env.ZOHO_ORG_ID.trim(),
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    const data = await response.json();
    
    res.status(200).json({
      total: data.count || 0,
      abertos: data.count || 0, 
      aguardando: 0
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro de sistema", detalhes: error.message });
  }
}
