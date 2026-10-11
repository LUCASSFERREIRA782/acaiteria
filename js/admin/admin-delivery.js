/**
 * admin-delivery.js
 * Lê e grava config/deliveryFees: { ativo, modo: "fixo"|"bairro", taxaFixa, bairros }
 */

function initDeliveryAdmin() {
  document.getElementById("delivery-modo").addEventListener("change", toggleDeliveryFields);
  document.getElementById("delivery-form").addEventListener("submit", saveDeliveryConfig);
  document.getElementById("add-bairro-btn").addEventListener("click", () => addBairroRow());
  loadDeliveryConfig();
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
