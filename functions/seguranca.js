/**
 * functions/seguranca.js
 * -------------------------------------------------------
 * Opções comuns das funções chamadas pelo cardápio público.
 * - Tempo e memória máximos: uma chamada travada não gera custo sem fim.
 * - App Check: quando EXIGIR_APP_CHECK = true, só aceita chamadas vindas
 *   do site verdadeiro (o navegador prova isso com o reCAPTCHA, sem
 *   pedir nada ao cliente). Fica false até o site publicado já enviar
 *   o token, para não derrubar pedidos de quem está com a página aberta.
 * -------------------------------------------------------
 */

const EXIGIR_APP_CHECK = false;

const OPCOES_PUBLICAS = {
  timeoutSeconds: 20,
  memory: "256MiB",
  enforceAppCheck: EXIGIR_APP_CHECK,
};

module.exports = { OPCOES_PUBLICAS, EXIGIR_APP_CHECK };
