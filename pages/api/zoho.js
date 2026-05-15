let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  // 1. Configuração de Headers (Cache e CORS)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Variáveis de Ambiente
  const rt = (process.env.ZOHO_REFRESH_TOKEN || "").trim();
  const ci = (process.env.ZOHO_CLIENT_ID || "").trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || "").trim();
  const oi = (process.env.ZOHO_ORG_ID || "").trim();
  const departmentId = "365059000000006907";

  try {
    // 3. Gestão do Token OAuth2
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
      if (!tokenData.access_token) {
        throw new Error("Erro na autenticação Zoho. Verifique as variáveis de ambiente.");
      }
      
      cachedToken = tokenData.access_token;
      tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutos
    }

    // 4. Chamada para a API do Zoho Desk (.com)
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

    // 5. Lógica de Contagem (Normalizada)
    let contagem = {
      abertos: 0,
      aguardando: 0,
      fechados: 0
    };

    // Definimos os grupos de status (em minúsculo para comparar)
    const statusAbertos = ["open", "aberto", "novo", "new"];
    const statusAguardando = ["on hold", "onhold", "aguardando", "espera", "pendente", "custom on hold"];
    const statusFechados = ["closed", "fechado", "concluído", "resolved", "resolvido"];

    Object.keys(rawStatusMap).forEach(statusOriginal => {
      const statusFormatado = statusOriginal.toLowerCase().trim();
      const qtd = parseInt(rawStatusMap[statusOriginal]) || 0;

      if (statusAbertos.includes(statusFormatado)) {
        contagem.abertos += qtd;
      } else if (statusFechados.includes(statusFormatado)) {
        contagem.fechados += qtd;
      } else if (statusAguardando.includes(statusFormatado)) {
        contagem.aguardando += qtd;
      } else {
        // Se cair aqui, é um status que não mapeamos (ex: "Em andamento")
        // Por padrão, somamos em abertos ou você pode criar uma nova categoria
        contagem.abertos += qtd;
      }
    });

    // 6. Resposta Final
    return res.status(200).json({
      abertos: contagem.abertos,
      aguardando: contagem.aguardando,
      fechados: contagem.fechados,
      totalGeral: data.allTicketsCount || 0,
      debug: rawStatusMap // Ajuda a ver se algum status novo apareceu
    });

  } catch (error) {
    console.error("Erro na Function:", error.message);
    return res.status(500).json({ erro: error.message });
  }
}
