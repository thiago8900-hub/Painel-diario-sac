let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  // Habilitar CORS caso o seu painel chame direto do front-end
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();
  const departmentId = "365059000000006907";

  try {
    // 1. Renovação do Token (Cache seguro de 50 minutos)
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
      
      if (!tokenData.access_token) throw new Error("Falha ao obter access_token: " + JSON.stringify(tokenData));
      
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutos seguros
    }

    // 2. Chamada para a API do Desk
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
    const rawStatusMap = data.byStatus || {};

    // 3. Processamento Dinâmico e Inteligente dos Status
    let abertos = 0;
    let fechados = 0;
    let aguardando = 0;

    // Definições de chaves (sempre em minúsculo para comparar)
    const chavesAberto = ["aberto", "open", "novo", "new"];
    const chavesFechado = ["fechado", "closed", "fechado inatividade"];

    Object.keys(rawStatusMap).forEach(statusOriginal => {
      const statusMinusculo = statusOriginal.toLowerCase().trim();
      const quantidade = rawStatusMap[statusOriginal] || 0;

      if (chavesAberto.includes(statusMinusculo)) {
        abertos += quantidade;
      } else if (chavesFechado.includes(statusMinusculo)) {
        fechados += quantidade;
      } else {
        // Qualquer status que não seja explicitamente "Aberto" ou "Fechado"
        // (Ex: Em Atendimento, Aguardando Cliente, Pendente, On Hold, etc)
        aguardando += quantity;
      }
    });

    const totalGeral = data.allTicketsCount || 0;

    // Retorno limpo para o seu painel, mas mantendo o debug para você checar
    return res.status(200).json({
      abertos,
      aguardando,
      fechados,
      totalGeral,
      debug: rawStatusMap // Mostra exatamente os nomes que o Zoho está cuspindo
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
