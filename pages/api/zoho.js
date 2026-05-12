export default async function handler(req, res) {
  try {
    // 1. Tenta autenticar no servidor GLOBAL (.com) pois seu Client ID é de lá
    const tokenUrl = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;
    
    const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(401).json({ 
        erro: "O Zoho Global recusou seu Token", 
        ajuda: "Verifique se o seu Refresh Token foi gerado no console .com",
        detalhes: tokenData 
      });
    }

    // 2. Com o token na mão, busca os dados no Desk BRASIL (.com.br)
    const deskUrl = `https://desk.zoho.com.br/api/v1/tickets?include=count`;
    
    const response = await fetch(deskUrl, {
      method: 'GET',
      headers: {
        'orgId': process.env.ZOHO_ORG_ID.trim(),
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    const data = await response.json();

    // 3. Resultado para o painel
    res.status(200).json({
      total: data.count || 0,
      abertos: data.count || 0,
      aguardando: 0
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro de Conexão", detalhes: error.message });
  }
}
