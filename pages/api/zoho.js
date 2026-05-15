{
  "diagnostico": {
    "variaveis": {
      "ZOHO_REFRESH_TOKEN": "ok (64 chars)",
      "ZOHO_ORG_ID": "AUSENTE"   ← exemplo de problema
    },
    "auth": {
      "httpStatus": 200,
      "resultado": "TOKEN OK"
    },
    "ticketsCount": {
      "httpStatus": 403,          ← aqui você vê o erro real
      "resposta": "{\"errorCode\":\"PERMISSION_DENIED\"...}"
    }
  }
}
