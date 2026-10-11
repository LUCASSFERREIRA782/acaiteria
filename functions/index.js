/**
 * functions/index.js
 * -------------------------------------------------------
 * Só o que precisa de privilégio de servidor:
 *   - conceder e revogar acesso de administrador;
 *   - gerar o Pix copia e cola sem expor a chave no site.
 *
 * Removido nesta versão:
 *   - Mercado Pago (pagamento online com cartão): o pagamento
 *     agora é Pix, maquininha na entrega ou no caixa;
 *   - e-mail de confirmação: o site não coleta e-mail do cliente.
 * -------------------------------------------------------
 */

const { initializeApp } = require("firebase-admin/app");
initializeApp();

const admins = require("./admins");

exports.concederAdmin = admins.concederAdmin;
exports.revogarAdmin = admins.revogarAdmin;

const pix = require("./pix");
exports.gerarPix = pix.gerarPix;
