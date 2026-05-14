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
      const tokenResponse = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: rt,
          client_id: ci,
          client_secret: cs,
          grant_type: 'refresh_token'
        })
      });
      const tokenData = await tokenResponse.json();
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3000000;
    }

    // Chamada para listar a contagem de tickets por STATUS real
    const response = await fetch(
      `https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}&includeByStatus=true`,
      {
        method: "GET",
        headers: { "orgId": oi, "Authorization": `Zoho-oauthtoken ${cachedToken}` }
      }
    );

    const data = await response.json();
    
    // Esse LOG aqui é o mais importante agora! 
    // Ele vai mostrar no Vercel algo como: { "Aberto": 10, "Em espera": 5 ... }
    console.log("LISTA REAL DE STATUS:", data.byStatus);

    // Por enquanto, vamos retornar tudo o que ele achar no 'byStatus' 
    // para você ver no navegador o que o Zoho está respondendo.
    return res.status(200).json({
      verificacao: data.byStatus || "Nenhum status detalhado encontrado",
      resumo: data
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
