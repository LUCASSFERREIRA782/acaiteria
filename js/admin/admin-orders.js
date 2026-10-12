/**
 * admin-orders.js
 * -------------------------------------------------------
 * Quadro de pedidos em tempo real (onSnapshot).
 * Novo → Preparando → Pronto (local) / Saiu (entrega) → Finalizado.
 * Toca um aviso sonoro quando chega pedido novo.
 * -------------------------------------------------------
 */

let unsubscribeOrders = null;
let ordersCache = [];
let knownOrderIds = null;   // null = primeira carga (não toca som)
let audioCtx = null;

const ORDER_PAYMENT = {
  pix: "Pix (copia e cola)",
  maquininha: "Maquininha na entrega",
  caixa_cartao: "Cartão no caixa",
  caixa_pix: "Pix (QR Code mesa/balcão)",
};

// Próximo passo de cada status, por modalidade
const NEXT_STATUS = {
  local:   { novo: ["preparo", "Começar preparo"], preparo: ["pronto", "Pronto p/ retirar"], pronto: ["concluido", "Entregue no balcão"] },
  entrega: { novo: ["preparo", "Começar preparo"], preparo: ["saiu", "Saiu p/ entrega"],     saiu:   ["concluido", "Entregue"] },
};

const STATUS_COL = { novo: "novo", preparo: "preparo", pronto: "pronto", saiu: "pronto", concluido: "fim", cancelado: "fim" };

function initOrdersAdmin() {
  document.getElementById("orders-range").addEventListener("change", startOrdersListener);
  document.getElementById("orders-board").addEventListener("click", onBoardClick);
  document.addEventListener("click", unlockAudio, { once: true });
  setInterval(renderOrders, 60 * 1000); // atualiza o "há X min"
}

function startOrdersListener() {
  stopOrdersListener();
  knownOrderIds = null;

  const range = document.getElementById("orders-range").value;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  if (range === "7") since.setDate(since.getDate() - 6);

  unsubscribeOrders = db.collection("pedidos")
    .where("criadoEm", ">=", since)
    .orderBy("criadoEm", "desc")
    .limit(300)
    .onSnapshot(snap => {
      ordersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ids = new Set(ordersCache.map(o => o.id));
      if (knownOrderIds) {
        const fresh = ordersCache.filter(o => !knownOrderIds.has(o.id) && o.status === "novo");
        if (fresh.length) notifyNewOrder(fresh.length);
      }
      knownOrderIds = ids;
      renderOrders();
    }, err => {
      console.error(err);
      document.getElementById("orders-summary").textContent = `Erro ao carregar pedidos: ${err.message}`;
    });
}

function stopOrdersListener() {
  if (unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders = null;
}

function minutesAgo(date) {
  if (!date) return "agora";
  const min = Math.floor((Date.now() - date.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderOrders() {
  const board = document.getElementById("orders-board");
  const cols = Object.fromEntries([...board.querySelectorAll(".board-col")].map(c => [c.dataset.col, []]));

  ordersCache.forEach(o => cols[STATUS_COL[o.status] || "novo"].push(o));
  // Em andamento: mais antigos primeiro (fila). Finalizados: mais recentes primeiro.
  ["novo", "preparo", "pronto"].forEach(k => cols[k].reverse());

  board.querySelectorAll(".board-col").forEach(col => {
    const list = cols[col.dataset.col];
    col.querySelector("h3").dataset.count = list.length;
    col.querySelector(".board-list").innerHTML = list.length
      ? list.map(orderCardHTML).join("")
      : `<p class="board-empty">—</p>`;
  });

  const newCount = cols.novo.length;
  const badge = document.getElementById("new-count");
  badge.hidden = newCount === 0;
  badge.textContent = newCount;
  document.title = newCount ? `(${newCount}) Painel — ${restaurantConfig.name}` : `Painel — ${restaurantConfig.name}`;

  const done = ordersCache.filter(o => o.status === "concluido");
  const revenue = done.reduce((s, o) => s + Number(o.total || 0), 0);
  document.getElementById("orders-summary").textContent =
    `${ordersCache.length} pedido(s) no período · ${done.length} finalizado(s) · ${money(revenue)} em pedidos finalizados`;
}

function orderCardHTML(o) {
  const date = o.criadoEm?.toDate?.() ?? null;
  const where = o.modo === "local"
    ? `<span class="o-tag o-tag--local">Aqui${o.mesa ? ` · Mesa ${esc(o.mesa)}` : ""}</span>`
    : `<span class="o-tag o-tag--entrega">Entrega${o.bairro ? ` · ${esc(o.bairro)}` : ""}</span>`;

  const items = (o.itens || []).map(i => {
    const det = [i.tamanho, (i.adicionais || []).join(", ")].filter(Boolean).join(" · ");
    return `<li><b>${Number(i.qtd)}×</b> ${esc(i.nome)}${det ? `<small>${esc(det)}</small>` : ""}${i.obs ? `<em>“${esc(i.obs)}”</em>` : ""}</li>`;
  }).join("");

  const next = NEXT_STATUS[o.modo]?.[o.status];
  const finished = o.status === "concluido" || o.status === "cancelado";

  return `
    <article class="o-card o-card--${esc(o.status)}" data-order-id="${esc(o.id)}">
      <header class="o-head">
        <span class="o-code">#${esc(o.codigo || o.id.slice(-4))}</span>
        <span class="o-time">${minutesAgo(date)}</span>
      </header>
      <div class="o-who"><strong>${esc(o.apelido || "—")}</strong>${where}</div>
      ${o.modo === "entrega" ? `<p class="o-note">Endereço chega pelo WhatsApp${o.atendente ? ` de <strong>${esc(o.atendente)}</strong>` : ""} com o código #${esc(o.codigo || "")}</p>` : ""}
      ${o.modo === "local" && o.pagamento === "caixa_pix" ? `<p class="o-note">Pix pelo QR Code da mesa/balcão: confira o comprovante</p>` : ""}
      <ul class="o-items">${items}</ul>
      <div class="o-pay">
        <span>${esc(ORDER_PAYMENT[o.pagamento] || o.pagamento || "—")}</span>
        <strong>${money(o.total)}</strong>
      </div>
      ${o.taxaEntrega ? `<div class="o-fee">inclui entrega ${money(o.taxaEntrega)}</div>` : ""}
      <footer class="o-actions">
        <label class="o-paid"><input type="checkbox" data-paid ${o.pago ? "checked" : ""}> Pago</label>
        ${o.status === "cancelado" ? `<span class="o-tag o-tag--off">Cancelado</span>` : ""}
        ${o.status === "concluido" ? `<span class="o-tag o-tag--ok">Finalizado</span>` : ""}
        ${!finished ? `<button type="button" class="a-btn a-btn--ghost a-btn--xs" data-cancel>Cancelar</button>` : ""}
        ${next ? `<button type="button" class="a-btn a-btn--ink a-btn--xs" data-next="${next[0]}">${next[1]} →</button>` : ""}
      </footer>
    </article>`;
}

async function onBoardClick(e) {
  const card = e.target.closest("[data-order-id]");
  if (!card) return;
  const id = card.dataset.orderId;
  const order = ordersCache.find(o => o.id === id);
  const ref = db.collection("pedidos").doc(id);

  try {
    if (e.target.matches("[data-paid]")) {
      await ref.update({ pago: e.target.checked, atualizadoEm: ts() });
    } else if (e.target.closest("[data-next]")) {
      await ref.update({ status: e.target.closest("[data-next]").dataset.next, atualizadoEm: ts() });
    } else if (e.target.closest("[data-cancel]")) {
      if (!confirm(`Cancelar o pedido #${order?.codigo || ""}?`)) return;
      await ref.update({ status: "cancelado", atualizadoEm: ts() });
    }
  } catch (err) {
    alert("Não foi possível atualizar: " + err.message);
  }
}

/* ---------- Aviso sonoro ---------- */

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch {}
}

function notifyNewOrder(n) {
  showToast(n === 1 ? "Chegou pedido novo!" : `Chegaram ${n} pedidos novos!`);
  if (!document.getElementById("sound-toggle").checked || !audioCtx) return;
  const t = audioCtx.currentTime;
  [660, 880, 990].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.3, t + i * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + i * 0.16);
    osc.stop(t + i * 0.16 + 0.16);
  });
}
