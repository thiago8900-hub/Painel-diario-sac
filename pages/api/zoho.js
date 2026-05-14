let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();
  const departmentId = "365059000000006907";

  try {
    // 1. Obter Access Token (Sempre .com)
    if (!cachedToken || Date.now() > tokenExpiry) {
      const tokenResponse = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: rt,
          client_id: ci,
          client_secret: cs,
          grant_type: "refresh_token"
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return res.status(401).json({ erro: "Token Inválido" });
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3000000;
    }

    // 2. Buscar contagem de tickets ABERTOS
    const openRes = await fetch(`https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}&status=Open`, {
      method: "GET",
      headers: { "orgId": oi, "Authorization": `Zoho-oauthtoken ${cachedToken}` }
    });
    const openData = await openRes.json();

    // 3. Buscar contagem de tickets AGUARDANDO (On Hold)
    const holdRes = await fetch(`https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}&status=On%20Hold`, {
      method: "GET",
      headers: { "orgId": oi, "Authorization": `Zoho-oauthtoken ${cachedToken}` }
    });
    const holdData = await holdRes.json();

    // Retorna os dados para o painel
    return res.status(200).json({
      abertos: openData.count || 0,
      aguardando: holdData.count || 0,
      total: (openData.count || 0) + (holdData.count || 0) // Soma dos dois para teste
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
