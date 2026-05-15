// api/zoho.js — Versão DIAGNÓSTICO (substitua temporariamente)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rt = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
  const ci = (process.env.ZOHO_CLIENT_ID     || '').trim();
  const cs = (process.env.ZOHO_CLIENT_SECRET || '').trim();
  const oi = (process.env.ZOHO_ORG_ID        || '').trim();
  const departmentId = process.env.ZOHO_DEPARTMENT_ID || '365059000000006907';

  const log = {};

  log.variaveis = {
    ZOHO_REFRESH_TOKEN: rt ? `ok (${rt.length} chars)` : 'AUSENTE',
    ZOHO_CLIENT_ID:     ci ? `ok (${ci.length} chars)` : 'AUSENTE',
    ZOHO_CLIENT_SECRET: cs ? `ok (${cs.length} chars)` : 'AUSENTE',
    ZOHO_ORG_ID:        oi ? `ok (${oi.length} chars)` : 'AUSENTE',
    departmentId,
  };

  let token = null;
  try {
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
    const tokenRaw = await tokenRes.text();
    log.auth = { httpStatus: tokenRes.status, resposta: tokenRaw.substring(0, 500) };
    const tokenData = JSON.parse(tokenRaw);
    if (tokenData.access_token) {
      token = tokenData.access_token;
      log.auth.resultado = 'TOKEN OK';
    } else {
      log.auth.resultado = 'FALHOU — sem access_token';
      return res.status(401).json({ erro: 'Falha na autenticação', log });
    }
  } catch (e) {
    log.auth = { erro: e.message };
    return res.status(500).json({ erro: 'Erro na autenticação', log });
  }

  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
    orgId: oi,
  };

  try {
    const r = await fetch('https://desk.zoho.com/api/v1/statuses?module=tickets', { headers });
    const raw = await r.text();
    log.statuses = { httpStatus: r.status, resposta: raw.substring(0, 1000) };
  } catch (e) {
    log.statuses = { erro: e.message };
  }

  try {
    const r = await fetch(
      `https://desk.zoho.com/api/v1/ticketsCount?departmentId=${departmentId}`,
      { headers }
    );
    const raw = await r.text();
    log.ticketsCount = { httpStatus: r.status, resposta: raw.substring(0, 1000) };
  } catch (e) {
    log.ticketsCount = { erro: e.message };
  }

  try {
    const r = await fetch(
      `https://desk.zoho.com/api/v1/tickets?departmentId=${departmentId}&from=1&limit=5`,
      { headers }
    );
    const raw = await r.text();
    log.tickets = { httpStatus: r.status, resposta: raw.substring(0, 1000) };
  } catch (e) {
    log.tickets = { erro: e.message };
  }

  try {
    const r = await fetch('https://desk.zoho.com/api/v1/departments', { headers });
    const raw = await r.text();
    log.departments = { httpStatus: r.status, resposta: raw.substring(0, 1000) };
  } catch (e) {
    log.departments = { erro: e.message };
  }

  return res.status(200).json({ diagnostico: log });
}
