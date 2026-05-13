let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();

  try {
    if (!cachedToken || Date.now() > tokenExpiry) {
      // Forçamos a chamada para o ACCOUNTS global (.com) pois seu ClientID é de lá
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

    // Chamada para o DESK Brasil (.com.br)
   // Substitua o número abaixo pelo ID do Departamento SAC que você copiou
    const departmentId = "365059000000006907"; 

    const deskResponse = await fetch(`https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}`, {
      method: 'GET',
      headers: {
        'orgId': oi,
        'Authorization': `Zoho-oauthtoken ${cachedToken}`
      }
    });

    const data = await deskResponse.json();
    
    return res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });
      }
    });

    const data = await deskResponse.json();
    
    return res.status(200).json({
      total: data.allTicketsCount || 0,
      abertos: data.openTicketsCount || 0,
      aguardando: data.onHoldTicketsCount || 0
    });

  } catch (error) {
    return res.status(500).json({ 
      etapa: "Falha de Rede", 
      mensagem: error.message,
      detalhes: "A Vercel não conseguiu alcançar os servidores da Zoho. Verifique se as URLs estão corretas." 
    });
  }
}
