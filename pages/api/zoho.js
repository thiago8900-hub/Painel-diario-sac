let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();
  const departmentId = "365059000000006907"; 

  try {
    if (!cachedToken || Date.now() > tokenExpiry) {
      const tokenResponse = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: rt,
          client_id: ci,
          client_secret: cs,
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

    // TENTATIVA 1: Servidor Global
    let deskResponse = await fetch(`https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}`, {
      method: 'GET',
      headers: { 'orgId': oi, 'Authorization': `Zoho-oauthtoken ${cachedToken}` }
    });

    let data = await deskResponse.json();

    // Se vier zerado, tentamos no Servidor Brasil (o mais provável para o seu caso)
    if (!data.allTicketsCount || data.allTicketsCount === 0) {
      const deskResponseBR = await fetch(`https://desk.zoho.com.br/api/v1/ticketsCount?departmentId=${departmentId}`, {
        method: 'GET',
        headers: { 'orgId': oi, 'Authorization': `Zoho-oauthtoken ${cachedToken}` }
      });
      const dataBR = await deskResponseBR.json();
      if (dataBR.allTicketsCount !== undefined) {
        data = dataBR;
      }
    }

    return res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    return res.status(500).json({ 
      etapa: "Falha Geral", 
      mensagem: error.message 
    });
  }
}
