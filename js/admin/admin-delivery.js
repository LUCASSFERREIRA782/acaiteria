/**
 * admin-delivery.js
 * Lê e grava config/deliveryFees: { ativo, modo: "fixo"|"bairro", taxaFixa, bairros }
 */

function initDeliveryAdmin() {
  document.getElementById("delivery-modo").addEventListener("change", toggleDeliveryFields);
  document.getElementById("delivery-form").addEventListener("submit", saveDeliveryConfig);
  document.getElementById("add-bairro-btn").addEventListener("click", () => addBairroRow());
  loadDeliveryConfig();

  document.getElementById("pix-form").addEventListener("submit", savePixConfig);
  document.getElementById("pix-key-type").addEventListener("change", updatePixHint);
  loadPixConfig();
}

/* ---------- Pix (config/pix — só admin lê, ver firestore.rules) ---------- */

const PIX_HINTS = {
  telefone: "Só números com DDD, ex.: 11977777777 (o +55 é colocado automaticamente).",
  email: "O e-mail cadastrado como chave no banco.",
  cpf: "Só os 11 números.",
  cnpj: "Só os 14 números.",
  aleatoria: "A chave de 32 caracteres com hífens que o banco gerou.",
};

function updatePixHint() {
  document.getElementById("pix-key-hint").textContent = PIX_HINTS[document.getElementById("pix-key-type").value];
}

async function loadPixConfig() {
  const doc = await db.collection("config").doc("pix").get();
  const p = doc.exists ? doc.data() : {};
  const type = p.keyType || "telefone";
  document.getElementById("pix-key-type").value = type;
  document.getElementById("pix-key").value = type === "telefone" ? String(p.key || "").replace(/^\+55/, "") : p.key || "";
  document.getElementById("pix-name").value = p.receiverName || "";
  document.getElementById("pix-city").value = p.city || "";
  updatePixHint();
}

/** Normaliza a chave no formato que o Banco Central exige no BR Code. */
function normalizePixKey(type, raw) {
  const v = raw.trim();
  const digits = v.replace(/\D/g, "");
  if (type === "telefone") return digits.length === 10 || digits.length === 11 ? "+55" + digits : digits.length === 13 && digits.startsWith("55") ? "+" + digits : null;
  if (type === "cpf") return digits.length === 11 ? digits : null;
  if (type === "cnpj") return digits.length === 14 ? digits : null;
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : null;
}

async function savePixConfig(e) {
  e.preventDefault();
  const errorEl = document.getElementById("pix-error");
  errorEl.textContent = "";
  const keyType = document.getElementById("pix-key-type").value;
  const key = normalizePixKey(keyType, document.getElementById("pix-key").value);
  if (!key) { errorEl.textContent = "Chave inválida para o tipo escolhido. " + PIX_HINTS[keyType]; return; }

  await db.collection("config").doc("pix").set({
    keyType,
    key,
    receiverName: document.getElementById("pix-name").value.trim(),
    city: document.getElementById("pix-city").value.trim(),
    atualizadoEm: ts(),
  });
  showToast("Pix salvo");
}

async function loadDeliveryConfig() {
  const doc = await db.collection("config").doc("deliveryFees").get();
  const cfg = doc.exists ? doc.data() : { ativo: true, modo: "fixo", taxaFixa: 5, bairros: [] };

  document.getElementById("delivery-ativo").checked = Boolean(cfg.ativo);
  // "distancia" (versão antiga) não existe mais — cai para taxa fixa
  document.getElementById("delivery-modo").value = cfg.modo === "bairro" ? "bairro" : "fixo";
  document.getElementById("taxa-fixa").value = cfg.taxaFixa ?? 0;
  document.getElementById("bairros-list").innerHTML = "";
  (cfg.bairros || []).forEach(b => addBairroRow(b.nome, b.taxa));
  toggleDeliveryFields();
}

function toggleDeliveryFields() {
  const modo = document.getElementById("delivery-modo").value;
  document.getElementById("delivery-fixo-fields").hidden = modo !== "fixo";
  document.getElementById("delivery-bairro-fields").hidden = modo !== "bairro";
  if (modo === "bairro" && !document.querySelector("#bairros-list .a-row")) addBairroRow();
}

function addBairroRow(nome = "", taxa = "") {
  const row = document.createElement("div");
  row.className = "a-row";
  row.innerHTML = `
    <input class="f-input" placeholder="Nome do bairro" maxlength="40" data-b-nome value="${esc(nome)}">
    <input class="f-input" type="number" step="0.50" min="0" placeholder="Taxa R$" data-b-taxa value="${esc(taxa)}">
    <button type="button" class="a-icon-btn" aria-label="Remover bairro">✕</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  document.getElementById("bairros-list").appendChild(row);
}

async function saveDeliveryConfig(e) {
  e.preventDefault();
  const bairros = [...document.querySelectorAll("#bairros-list .a-row")]
    .map(r => ({
      nome: r.querySelector("[data-b-nome]").value.trim(),
      taxa: Math.max(0, parseFloat(r.querySelector("[data-b-taxa]").value) || 0),
    }))
    .filter(b => b.nome);

  const modo = document.getElementById("delivery-modo").value;
  if (modo === "bairro" && !bairros.length) { alert("Cadastre pelo menos um bairro."); return; }

  await db.collection("config").doc("deliveryFees").set({
    ativo: document.getElementById("delivery-ativo").checked,
    modo,
    taxaFixa: Math.max(0, parseFloat(document.getElementById("taxa-fixa").value) || 0),
    bairros,
    atualizadoEm: ts(),
  });
  showToast("Entrega salva");
}
