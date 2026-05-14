let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();
  const departmentId = "365059000000006907";

  try {
    // 1. Renovação do Token (Mantido, mas com URL .com explícita)
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
      
      if (!tokenData.access_token) throw new Error("Falha ao obter access_token");
      
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3500000; // ~58 minutos
    }

    // 2. Chamada para a API do Desk (Sempre .com)
    const response = await fetch(
      `https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}&includeByStatus=true`,
      {
        method: "GET",
        headers: { 
          "orgId": oi, 
          "Authorization": `Zoho-oauthtoken ${cachedToken}` 
        }
      }
    );

    const data = await response.json();
    
    // 3. Tratamento Robusto dos Status
    // O Zoho retorna os nomes exatos configurados no seu CRM. 
    // Vamos normalizar as chaves para evitar erro de Case Sensitive.
    const rawStatusMap = data.byStatus || {};
    const statusMap = {};
    
    Object.keys(rawStatusMap).forEach(key => {
      statusMap[key.toLowerCase()] = rawStatusMap[key];
    });

    // Soma de variações comuns (ajuste conforme o nome exato no seu Zoho)
    const abertos = (statusMap["aberto"] || 0) + (statusMap["open"] || 0) + (statusMap["novo"] || 0);
    const aguardando = (statusMap["aguardando"] || 0) + (statusMap["on hold"] || 0) + (statusMap["em espera"] || 0) + (statusMap["pendente"] || 0);

    return res.status(200).json({
      abertos,
      aguardando,
      totalGeral: data.allTicketsCount || 0,
      debug: rawStatusMap // Verifique aqui os nomes reais que o Zoho está enviando
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
