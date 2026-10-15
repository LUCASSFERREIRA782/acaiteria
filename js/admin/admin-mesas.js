/**
 * admin-mesas.js
 * -------------------------------------------------------
 * QR Code por mesa, com código próprio de cada mesa:
 *   ?mesa=7&c=<código aleatório>
 *
 *   config/mesas         (público)  { quantidade, porQr }
 *   config/mesasPrivado  (só admin) { quantidade, codigos: { "1": "…", … } }
 *
 * Ativado o QR por mesa, a Cloud Function criarPedido só aceita pedido
 * "na mesa" com o código impresso daquela mesa (ninguém pede "da mesa 5"
 * de fora da loja) e o campo de mesa digitada some do site. Desativado,
 * volta ao jeito antigo (mesa digitada, opcional).
 * "Gerar novos códigos" invalida QR copiado ou trocado.
 * Os QR Codes são gerados aqui mesmo (js/qr.js), sem serviço de fora.
 * -------------------------------------------------------
 */

const MAX_MESAS = 80;
let mesasPrivado = { quantidade: 0, codigos: {} };
let mesasPorQr = false;

function initTablesAdmin() {
  document.getElementById("tables-form").addEventListener("submit", saveTables);
  document.getElementById("print-tables-btn").addEventListener("click", () => window.print());
  document.getElementById("tables-new-codes-btn").addEventListener("click", novosCodigos);
  document.getElementById("tables-toggle-btn").addEventListener("click", alternarQrPorMesa);
  loadTables();
}

/** Endereço público do cardápio (o mesmo site, sem a parte /admin). */
const menuBaseUrl = () => `${location.origin}${location.pathname.replace(/admin\/?(index\.html)?$/, "")}`;

/** Código aleatório de 8 letras/números (sem caracteres parecidos). */
function codigoMesa() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => chars[b % chars.length]).join("");
}

/** Código para as mesas 1..n, mantendo os que já existem (QR impresso continua valendo). */
function completarCodigos(n, codigos = {}) {
  const out = {};
  for (let i = 1; i <= n; i++) out[i] = codigos[i] || codigoMesa();
  return out;
}

async function gravarMesas(n, codigos, porQr) {
  const b = db.batch();
  b.set(db.collection("config").doc("mesas"), { quantidade: n, porQr, atualizadoEm: ts() });
  b.set(db.collection("config").doc("mesasPrivado"), { quantidade: n, codigos: porQr ? codigos : {}, atualizadoEm: ts() });
  await b.commit();
  mesasPrivado = { quantidade: n, codigos: porQr ? codigos : {} };
  mesasPorQr = porQr;
}

async function loadTables() {
  const [pub, priv] = await Promise.all([
    db.collection("config").doc("mesas").get(),
    db.collection("config").doc("mesasPrivado").get(),
  ]);
  const p = priv.exists ? priv.data() : {};
  mesasPorQr = pub.exists && Boolean(pub.data().porQr);
  mesasPrivado = { quantidade: Number(p.quantidade || pub.data()?.quantidade) || 10, codigos: p.codigos || {} };
  document.getElementById("tables-count").value = mesasPrivado.quantidade;
  renderTables();
}

const urlDaMesa = mesa => `${menuBaseUrl()}?mesa=${encodeURIComponent(mesa)}&c=${encodeURIComponent(mesasPrivado.codigos[mesa])}`;

function renderTables() {
  const wrap = document.getElementById("tables-grid");
  const status = document.getElementById("tables-status");
  document.getElementById("tables-toggle-btn").textContent = mesasPorQr ? "Desativar QR por mesa" : "Ativar QR por mesa";
  document.getElementById("tables-new-codes-btn").hidden = !mesasPorQr;
  document.getElementById("print-tables-btn").hidden = !mesasPorQr;
  status.className = `a-store-status ${mesasPorQr ? "is-open" : "is-closed"}`;
  status.textContent = mesasPorQr ? "QR por mesa ativo" : "QR por mesa desligado (mesa digitada)";

  if (!mesasPorQr) {
    wrap.innerHTML = `<p class="a-empty">Ative o QR por mesa para gerar um QR Code com código próprio para cada mesa. Enquanto estiver desligado, o cliente digita a mesa (como hoje).</p>`;
    return;
  }
  wrap.innerHTML = Array.from({ length: mesasPrivado.quantidade }, (_, i) => {
    const mesa = String(i + 1), url = urlDaMesa(mesa);
    return `
      <figure class="a-table-card">
        <div class="a-table-qr">${qrSvg(url)}</div>
        <figcaption>
          <strong>Mesa ${esc(mesa)}</strong>
          <span>Aponte a câmera e peça por aqui</span>
          <span class="a-table-url">${esc(url.replace(/^https?:\/\//, ""))}</span>
          <a class="a-table-link" href="${esc(url)}" target="_blank" rel="noopener">testar</a>
        </figcaption>
      </figure>`;
  }).join("");
}

async function saveTables(e) {
  e.preventDefault();
  const n = Math.min(MAX_MESAS, Math.max(1, parseInt(document.getElementById("tables-count").value, 10) || 1));
  await gravarMesas(n, completarCodigos(n, mesasPrivado.codigos), mesasPorQr);
  renderTables();
  showToast(mesasPorQr ? `${n} mesa(s) prontas para imprimir` : `${n} mesa(s) cadastradas`);
}

async function alternarQrPorMesa() {
  const n = mesasPrivado.quantidade || 10;
  if (!mesasPorQr) {
    if (!confirm(`Ativar QR por mesa para ${n} mesas?\n\nDepois de ativar, o pedido só entra como "na mesa" pelo QR Code impresso de cada mesa (o campo de mesa digitada some do site). Imprima e cole os QR Codes antes de avisar a equipe.`)) return;
    await gravarMesas(n, completarCodigos(n, {}), true);
    showToast("QR por mesa ativado. Imprima os QR Codes.");
  } else {
    if (!confirm("Desativar QR por mesa?\n\nO cliente volta a digitar a mesa e os QR Codes impressos deixam de ter código (passam a valer como mesa digitada).")) return;
    await gravarMesas(n, {}, false);
    showToast("QR por mesa desligado: mesa digitada");
  }
  renderTables();
}

async function novosCodigos() {
  if (!confirm("Gerar códigos novos para TODAS as mesas?\n\nOs QR Codes impressos param de valer como mesa: será preciso imprimir de novo. Use se algum QR foi copiado, fotografado ou trocado.")) return;
  await gravarMesas(mesasPrivado.quantidade, completarCodigos(mesasPrivado.quantidade, {}), true);
  renderTables();
  showToast("Códigos novos gerados. Imprima os QR Codes de novo.");
}
