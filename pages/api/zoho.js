// api/zoho.js — Handler Zoho Desk para Vercel
// Busca tickets por status usando endpoint confiável com paginação

export default async function handler(req, res) {
  // ── CORS & Cache ──────────────────────────────────────────────────────────
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Variáveis de Ambiente ─────────────────────────────────────────────────
  const rt = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
  const ci = (process.env.ZOHO_CLIENT_ID     || '').trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || '').trim();
  const oi = (process.env.ZOHO_ORG_ID        || '').trim();
  const departmentId = process.env.ZOHO_DEPARTMENT_ID || '365059000000006907';

  if (!rt || !ci || !cs || !oi) {
    return res.status(500).json({
      erro: 'Variáveis de ambiente incompletas',
      detalhes: {
        ZOHO_REFRESH_TOKEN: !!rt,
        ZOHO_CLIENT_ID:     !!ci,
        ZOHO_CLIENT_SECRET: !!cs,
        ZOHO_ORG_ID:        !!oi,
      }
    });
  }

  try {
    // ── 1. Obter Access Token (sem cache — serverless não mantém estado) ────
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: rt,
        client_id:     ci,
        client_secret: cs,
        grant_type:    'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(401).json({
        erro:    'Falha na autenticação OAuth2',
        detalhes: tokenData,
      });
    }

    const token = tokenData.access_token;
    const headers = {
      Authorization: `Zoho-oauthtoken ${token}`,
      orgId:         oi,
    };

    // ── 2. Buscar TODOS os status disponíveis via /statuses ──────────────────
    // Isso nos dá os nomes exatos que a instância usa
    const statusesRes = await fetch(
      `https://desk.zoho.com/api/v1/statuses?module=tickets`,
      { headers }
    );
    const statusesData = await statusesRes.json();
    const todosOsStatus = (statusesData.data || []).map(s => ({
      id:   s.id,
      nome: s.displayName || s.name || '',
    }));

    // ── 3. Buscar contagem de tickets por status com paginação ───────────────
    // O endpoint /ticketsCount pode ser instável; usamos /tickets com from/limit
    // e acumulamos por status até esgotarem os resultados.
    //
    // Estratégia: buscar em blocos de 100 filtrando por departmentId,
    // só status "abertos" e "aguardando" para economizar chamadas.

    // Grupos de status (normalizados para comparação case-insensitive)
    const grupoAbertos = [
      'aberto', 'open', 'novo', 'new',
      'continuidade sac', 'realizar estorno',
    ];
    const grupoAguardando = [
      'aguardando', 'on hold', 'em espera', 'pendente',
      'aguardando emissão de nf pela neosolar', 'custom on hold',
    ];

    const normalizar = str => (str || '').toLowerCase().trim();

    // Identifica os IDs de status que nos interessam
    const idsAbertos    = todosOsStatus.filter(s => grupoAbertos.includes(normalizar(s.nome))).map(s => s.id);
    const idsAguardando = todosOsStatus.filter(s => grupoAguardando.includes(normalizar(s.nome))).map(s => s.id);

    // ── 4. Buscar contagem via endpoint /ticketsCount (com fallback) ─────────
    let contadores = { somenteAbertos: 0, somenteAguardando: 0 };
    let rawStatusMap = {};
    let metodo = '';

    // Tentativa A: endpoint /ticketsCount (rápido, mas nem sempre disponível)
    try {
      const countRes = await fetch(
        `https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}`,
        { headers }
      );
      const countData = await countRes.json();

      // O Zoho pode retornar { byStatus: {...} } ou { statuswise: [...] }
      if (countData.byStatus && Object.keys(countData.byStatus).length > 0) {
        rawStatusMap = countData.byStatus;
        metodo = 'ticketsCount.byStatus';
      } else if (Array.isArray(countData.statuswise)) {
        countData.statuswise.forEach(item => {
          rawStatusMap[item.status] = item.count;
        });
        metodo = 'ticketsCount.statuswise';
      }
    } catch (_) {
      // ignora, cai no fallback
    }

    // Tentativa B: /views (busca a view "Abertos" e "Aguardando" diretamente)
    if (Object.keys(rawStatusMap).length === 0) {
      try {
        const viewsRes = await fetch(
          `https://desk.zoho.com/api/v1/views?module=tickets&type=standard`,
          { headers }
        );
        const viewsData = await viewsRes.json();
        const views = viewsData.data || [];

        // Procura views com nomes que indicam status aberto/aguardando
        for (const view of views) {
          const nome = normalizar(view.displayName || view.name || '');
          if (grupoAbertos.some(g => nome.includes(g))) {
            contadores.somenteAbertos += parseInt(view.count || 0);
          } else if (grupoAguardando.some(g => nome.includes(g))) {
            contadores.somenteAguardando += parseInt(view.count || 0);
          }
        }
        metodo = 'views';
      } catch (_) {
        // ignora
      }
    }

    // Tentativa C (fallback definitivo): paginação manual em /tickets
    if (Object.keys(rawStatusMap).length === 0 && contadores.somenteAbertos === 0 && contadores.somenteAguardando === 0) {
      metodo = 'paginacao_manual';
      const MAX_PAGES = 10; // segurança: máximo 1000 tickets
      let from = 1;

      for (let page = 0; page < MAX_PAGES; page++) {
        const ticketsRes = await fetch(
          `https://desk.zoho.com/api/v1/tickets?departmentId=${departmentId}&from=${from}&limit=100&include=statusType`,
          { headers }
        );
        const ticketsData = await ticketsRes.json();
        const tickets = ticketsData.data || [];
        if (tickets.length === 0) break;

        tickets.forEach(t => {
          const status = normalizar(t.status || '');
          if (!rawStatusMap[t.status]) rawStatusMap[t.status] = 0;
          rawStatusMap[t.status]++;
        });

        from += 100;
        if (tickets.length < 100) break;
      }
    }

    // ── 5. Calcular totais a partir do rawStatusMap ──────────────────────────
    if (Object.keys(rawStatusMap).length > 0) {
      contadores = { somenteAbertos: 0, somenteAguardando: 0 };

      Object.entries(rawStatusMap).forEach(([statusOriginal, quantidade]) => {
        const statusNorm = normalizar(statusOriginal);
        const qtd = parseInt(quantidade) || 0;

        if (grupoAbertos.includes(statusNorm)) {
          contadores.somenteAbertos += qtd;
        } else if (grupoAguardando.includes(statusNorm)) {
          contadores.somenteAguardando += qtd;
        }
      });
    }

    // ── 6. Resposta final ─────────────────────────────────────────────────────
    return res.status(200).json({
      // Dados principais para o painel
      totaisAbertoAguardando: contadores.somenteAbertos + contadores.somenteAguardando,
      somenteAbertos:         contadores.somenteAbertos,
      somenteAguardando:      contadores.somenteAguardando,

      // Debug — ajuda a identificar nomes de status não mapeados
      debug: {
        metodoUsado:      metodo,
        departmentId,
        statusDisponiveis: rawStatusMap,         // todos os status retornados com suas contagens
        statusCadastrados: todosOsStatus,         // lista completa de status da instância
        naoMapeados: Object.keys(rawStatusMap).filter(s => {
          const n = normalizar(s);
          return !grupoAbertos.includes(n) && !grupoAguardando.includes(n);
        }),
      },
    });

  } catch (error) {
    return res.status(500).json({
      erro:   error.message,
      stack:  process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
