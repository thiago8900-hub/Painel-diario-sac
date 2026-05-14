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

    // Buscamos a contagem com o parâmetro includeByStatus
    const response = await fetch(
      `https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}&includeByStatus=true`,
      {
        method: "GET",
        headers: { "orgId": oi, "Authorization": `Zoho-oauthtoken ${cachedToken}` }
      }
    );

    const data = await response.json();
    
    // Mapeamento dinâmico para os status em Português
    const statusMap = data.byStatus || {};
    
    // Aqui pegamos qualquer variação de "Aberto" ou "Open"
    const abertos = statusMap["Aberto"] || statusMap["Em aberto"] || statusMap["Open"] || statusMap["Novo"] || 0;
    
    // Aqui pegamos qualquer variação de "Aguardando" ou "On Hold"
    const aguardando = statusMap["Aguardando"] || statusMap["Em espera"] || statusMap["On Hold"] || statusMap["Pendente"] || 0;

    return res.status(200).json({
      abertos: abertos,
      aguardando: aguardando,
      debug: statusMap // Isso vai mostrar todos os nomes reais no seu navegador
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
