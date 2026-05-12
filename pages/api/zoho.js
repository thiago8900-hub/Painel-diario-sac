let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  try {
    // Só pede token novo se o anterior tiver mais de 50 minutos
    if (!cachedToken || Date.now() > tokenExpiry) {
      const tokenResponse = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
        method: 'POST',
        body: new URLSearchParams({
          refresh_token: process.env.ZOHO_REFRESH_TOKEN.trim(),
          client_id: process.env.ZOHO_CLIENT_ID.trim(),
          client_secret: process.env.ZOHO_CLIENT_SECRET.trim(),
          grant_type: 'refresh_token'
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        return res.status(401).json({ etapa: "Erro no Token", resposta: tokenData });
      }

      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3000000; // Cache por 50 min
    }

    const deskResponse = await fetch(`https://desk.zoho.com.br/api/v1/ticketsCount`, {
      headers: {
        'orgId': process.env.ZOHO_ORG_ID.trim(),
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
