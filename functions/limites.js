/**
 * functions/limites.js
 * -------------------------------------------------------
 * Limite de pedidos guardado no Firestore (vale para todas as
 * instâncias da função, ao contrário de um contador em memória).
 *
 * - Por IP: segura um mesmo aparelho/rede disparando pedidos.
 *   É generoso porque as mesas do salão dividem o Wi-Fi da loja.
 * - Global ("disjuntor"): segura ataque espalhado por muitos IPs.
 *
 * O IP nunca é gravado: vira um hash (com o dia no sal) só para
 * servir de chave do contador. Os contadores ficam em /_limites,
 * coleção que as regras do Firestore bloqueiam para o navegador.
 * O campo expiraEm permite apagar os antigos com uma política TTL.
 * -------------------------------------------------------
 */

const crypto = require("crypto");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");

/**
 * IP de quem chamou. No Cloud Run o Google ACRESCENTA o IP real ao fim do
 * X-Forwarded-For; valores no início podem ter sido inventados pelo cliente.
 */
function ipDe(request) {
  const xff = String(request.rawRequest?.headers?.["x-forwarded-for"] || "");
  const partes = xff.split(",").map(s => s.trim()).filter(Boolean);
  return partes[partes.length - 1] || request.rawRequest?.ip || "desconhecido";
}

const hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 40);

/**
 * Conta +1 na janela e recusa (resource-exhausted) se passar de `max`.
 * Uma transação curta: 1 leitura + 1 escrita por chamada.
 */
async function limitar(chave, max, janelaMs, mensagem) {
  const db = getFirestore();
  const ref = db.collection("_limites").doc(hash(`${chave}|${new Date().toISOString().slice(0, 10)}`));
  await db.runTransaction(async t => {
    const snap = await t.get(ref);
    const agora = Date.now();
    const atual = snap.exists ? snap.data() : null;
    const ativa = atual && atual.ate?.toMillis() > agora;
    const n = ativa ? atual.n + 1 : 1;
    if (n > max) throw new HttpsError("resource-exhausted", mensagem);
    const ate = ativa ? atual.ate : Timestamp.fromMillis(agora + janelaMs);
    t.set(ref, { n, ate, expiraEm: Timestamp.fromMillis(ate.toMillis() + 24 * 60 * 60 * 1000) });
  });
}

const DEZ_MIN = 10 * 60 * 1000;

/** Pedidos: 15 por IP e 100 na loja inteira a cada 10 minutos. */
async function limitarPedido(request) {
  await limitar(`pedido-ip|${ipDe(request)}`, 15, DEZ_MIN, "Muitos pedidos seguidos desta rede. Aguarde alguns minutos ou chame a loja no WhatsApp.");
  await limitar("pedido-global", 100, DEZ_MIN, "Recebemos muitos pedidos agora. Tente de novo em alguns minutos ou chame a loja no WhatsApp.");
}

/** Pix: 30 por IP a cada 10 minutos (o cliente pode reabrir a tela de pagamento). */
async function limitarPix(request) {
  await limitar(`pix-ip|${ipDe(request)}`, 30, DEZ_MIN, "Muitas tentativas. Aguarde alguns minutos.");
}

module.exports = { limitar, limitarPedido, limitarPix, ipDe };
