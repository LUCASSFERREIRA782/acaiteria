/**
 * functions/pix.js
 * -------------------------------------------------------
 * Gera o Pix "copia e cola" no servidor. A chave e o nome do
 * recebedor ficam em config/pix (só admin lê) e nunca aparecem
 * no código público do site.
 *
 * O cliente só recebe o código se informar o ID de um pedido
 * de entrega, pago com Pix, criado nas últimas 24 h. O valor
 * vem do pedido gravado — não do navegador.
 * -------------------------------------------------------
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

function field(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function plainAscii(text, max) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max);
}

/** BR Code estático (padrão EMV do Banco Central). */
function pixCopiaECola({ key, receiverName, city }, amount, txid) {
  const account = field("00", "br.gov.bcb.pix") + field("01", key);
  const ref = plainAscii(txid, 25).replace(/ /g, "") || "***";
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (amount > 0 ? field("54", amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", plainAscii(receiverName, 25)) +
    field("60", plainAscii(city, 15)) +
    field("62", field("05", ref)) +
    "6304";
  return payload + crc16(payload);
}

exports.pixCopiaECola = pixCopiaECola; // usado nos testes

exports.gerarPix = onCall(async request => {
  const orderId = String(request.data?.orderId || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(orderId)) throw new HttpsError("invalid-argument", "Pedido inválido.");

  const db = getFirestore();
  const [orderSnap, pixSnap] = await Promise.all([
    db.collection("pedidos").doc(orderId).get(),
    db.collection("config").doc("pix").get(),
  ]);

  if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido não encontrado.");
  const order = orderSnap.data();
  const created = order.criadoEm?.toDate?.();
  if (order.modo !== "entrega" || order.pagamento !== "pix") throw new HttpsError("failed-precondition", "Este pedido não é pago com Pix.");
  if (order.status === "cancelado") throw new HttpsError("failed-precondition", "Pedido cancelado.");
  if (!created || Date.now() - created.getTime() > 24 * 60 * 60 * 1000) throw new HttpsError("deadline-exceeded", "Pedido expirado.");

  const pix = pixSnap.exists ? pixSnap.data() : null;
  if (!pix?.key || !pix?.receiverName || !pix?.city) {
    throw new HttpsError("unavailable", "Pix ainda não configurado pela loja.");
  }

  return { copiaECola: pixCopiaECola(pix, Number(order.total), order.codigo || orderId.slice(0, 8)) };
});
