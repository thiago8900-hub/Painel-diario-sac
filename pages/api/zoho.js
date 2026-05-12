export default async function handler(req, res) {
  // 1. Pega um Token novo usando seu Refresh Token
  const tokenResponse = await fetch(`https://accounts.zoho.com/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, {
    method: 'POST'
  });
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // 2. Busca a contagem de tickets
  const response = await fetch(`https://desk.zoho.com/api/v1/ticketsCount`, {
    headers: {
      'orgId': process.env.ZOHO_ORG_ID,
      'Authorization': `Zoho-oauthtoken ${accessToken}`
    }
  });

  const data = await response.json();
  
  // 3. Devolve os dados bonitinhos para o painel
  res.status(200).json({
    total: data.allTicketsCount,
    abertos: data.openTicketsCount,
    aguardando: data.onHoldTicketsCount
  });
}
