export default async function handler(req, res) {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
  const orgId = process.env.ZOHO_ORG_ID?.trim();

  try {
    // PASSO 1: Tentar pegar o Access Token no servidor GLOBAL
    const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(401).json({ etapa: "Erro no Token", resposta: tokenData });
    }

    // PASSO 2: Tentar buscar os dados no servidor BRASIL
    const deskUrl = `https://desk.zoho.com.br/api/v1/ticketsCount`;
    const deskResponse = await fetch(deskUrl, {
      method: 'GET',
      headers: {
        'orgId': orgId,
        'Authorization': `Zoho-oauthtoken ${tokenData.access_token}`
      }
    });

    if (!deskResponse.ok) {
      const erroTexto = await deskResponse.text();
      return res.status(deskResponse.status).json({ etapa: "Erro no Desk", detalhes: erroTexto });
    }

    const data = await deskResponse.json();

    return res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    // Se cair aqui, é um erro de rede (DNS, bloqueio ou URL errada)
    return res.status(500).json({ 
      etapa: "Falha de Rede", 
      mensagem: error.message,
      dica: "Verifique se as URLs da Zoho estão acessíveis"
    });
  }
}
