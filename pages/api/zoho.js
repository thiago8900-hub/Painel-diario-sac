let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  // 1. Headers de Cache e CORS
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
    // 2. Gestão de Token OAuth2 (.com)
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
      if (!tokenData.access_token) throw new Error("Falha na autenticação Zoho");
      
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 3000000; // ~50 min
    }

    // 3. Chamada à API de Contagem (Mais rápida que listar tickets)
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

    // 4. Lógica de Agrupamento (Aprendizado do Antigravity)
    let contadores = {
      somenteAbertos: 0,
      somenteAguardando: 0
    };

    // Definição dos grupos baseada no seu código anterior
    const grupoAbertos = ["aberto", "open", "novo", "new", "continuidade sac", "realizar estorno"];
    const grupoAguardando = ["aguardando", "on hold", "em espera", "pendente", "aguardando emissão de nf pela neosolar", "custom on hold"];

    Object.keys(rawStatusMap).forEach(statusOriginal => {
      const statusFormatado = statusOriginal.toLowerCase().trim();
      const quantidade = parseInt(rawStatusMap[statusOriginal]) || 0;

      if (grupoAbertos.includes(statusFormatado)) {
        contadores.somenteAbertos += quantidade;
      } else if (grupoAguardando.includes(statusFormatado)) {
        contadores.somenteAguardando += quantidade;
      }
      // Status que não estão nesses grupos (como "Fechado") são ignorados aqui
    });

    // 5. Resposta Final para o seu Painel
    return res.status(200).json({
      totaisAbertoAguardando: contadores.somenteAbertos + contadores.somenteAguardando,
      somenteAbertos: contadores.somenteAbertos,
      somenteAguardando: contadores.somenteAguardando,
      debug: rawStatusMap // Útil para validar se algum status novo apareceu
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
