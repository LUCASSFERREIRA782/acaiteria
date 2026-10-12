/**
 * checkout.js
 * -------------------------------------------------------
 * Comanda → pedido.
 *
 * Pagamento (nenhum dado de cartão passa pelo site):
 *   Entrega ........ Pix (copia e cola com valor) ou maquininha na porta
 *   Consumir aqui .. cartão ou Pix, pagos no caixa
 *
 * Privacidade: o Firestore recebe só o necessário para a cozinha
 * (apelido, mesa OU bairro, itens, valores). Endereço completo
 * nunca é gravado — fica em memória até o cliente tocar em
 * "Enviar endereço no WhatsApp" e é apagado em seguida.
 * As regras do Firestore recusam qualquer campo extra.
 * -------------------------------------------------------
 */

const PAYMENT_OPTIONS = {
  entrega: [
    { id: "pix",        label: "Pix",                   hint: "Mostramos o copia e cola com o valor certinho" },
    { id: "maquininha", label: "Maquininha na entrega", hint: "Débito ou crédito na porta de casa" },
  ],
  local: [
    { id: "caixa_cartao", label: "Cartão no caixa", hint: "Débito ou crédito" },
    { id: "caixa_pix",    label: "Pix no caixa",    hint: "QR Code no balcão" },
  ],
};

const PAYMENT_LABELS = {
  pix: "Pix", maquininha: "Maquininha na entrega",
  caixa_cartao: "Cartão no caixa", caixa_pix: "Pix no caixa",
};

const checkout = {
  modo: "local",
  pagamento: "caixa_cartao",
  apelido: "",
  mesa: "",
  bairro: "",
  endereco: { cep: "", rua: "", numero: "", complemento: "", referencia: "", cidade: "" }, // só em memória
  cepStatus: "",      // mensagem abaixo do campo CEP
  cepLookup: "",      // último CEP consultado (evita consulta repetida)
  sending: false,
};

let activeOrder = null;        // { id, code, modo, pagamento, total, unsubscribe }
let currentSheet = null;       // "order" | "tracking" | null

function onSheetClosed() {
  currentSheet = null;
}

function wipeAddress() {
  checkout.endereco = { cep: "", rua: "", numero: "", complemento: "", referencia: "", cidade: "" };
  checkout.cepStatus = "";
  checkout.cepLookup = "";
}

/* ---------------- Taxa de entrega ---------------- */

function deliveryAvailable() {
  return Boolean(catalog.delivery?.ativo);
}

function deliveryFee() {
  if (checkout.modo !== "entrega") return 0;
  const d = catalog.delivery;
  if (d.modo === "bairro") {
    const b = (d.bairros || []).find(x => x.nome === checkout.bairro);
    return b ? Number(b.taxa) : 0;
  }
  return Number(d.taxaFixa || 0);
}

/* ---------------- Comanda ---------------- */

function openOrderSheet() {
  if (!cart.items.length) {
    if (activeOrder) openTrackingSheet();
    return;
  }
  currentSheet = "order";
  openSheet(`<div class="ticket" id="order-body"></div>`, "Sua comanda");
  renderOrderBody();
}

function renderOrderBody() {
  const body = document.getElementById("order-body");
  if (!body) return;
  if (!cart.items.length) { closeSheet(); return; }

  if (checkout.modo === "entrega" && !deliveryAvailable()) checkout.modo = "local";
  const options = PAYMENT_OPTIONS[checkout.modo];
  if (!options.some(o => o.id === checkout.pagamento)) checkout.pagamento = options[0].id;

  const d = catalog.delivery;
  const fee = deliveryFee();
  const subtotal = cartSubtotal();
  const status = openStatus(restaurantConfig.hours);

  const itemsHTML = cart.items.map((item, i) => `
    <li class="ticket-item">
      <div class="ticket-item-main">
        <span class="ticket-item-name">${esc(item.name)}</span>
        ${itemDetailsText(item) ? `<span class="ticket-item-details">${esc(itemDetailsText(item))}</span>` : ""}
      </div>
      <div class="stepper stepper--sm" role="group" aria-label="Quantidade de ${esc(item.name)}">
        <button type="button" data-qty="${i}" data-delta="-1" aria-label="Diminuir">−</button>
        <output>${item.qty}</output>
        <button type="button" data-qty="${i}" data-delta="1" aria-label="Aumentar">+</button>
      </div>
      <span class="ticket-item-price">${money(item.unit * item.qty)}</span>
    </li>`).join("");

  const bairroField = d.modo === "bairro"
    ? `<label class="field-group">
         <span class="legend">Bairro <span class="req">obrigatório</span></span>
         <select class="field" name="bairro" required>
           <option value="">Escolha seu bairro</option>
           ${(d.bairros || []).map(b => `<option value="${esc(b.nome)}" ${checkout.bairro === b.nome ? "selected" : ""}>${esc(b.nome)} · ${money(b.taxa)}</option>`).join("")}
         </select>
       </label>`
    : `<label class="field-group">
         <span class="legend">Bairro</span>
         <input class="field" name="bairro" maxlength="40" autocomplete="off" value="${esc(checkout.bairro)}">
       </label>`;

  const cepField = `
    <div class="field-row">
      <label class="field-group">
        <span class="legend">CEP</span>
        <input class="field" name="cep" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="00000-000" value="${esc(checkout.endereco.cep)}">
      </label>
      <div class="field-group cep-help">
        <a class="cep-link" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a>
      </div>
    </div>
    <p class="cep-status" id="cep-status" role="status">${esc(checkout.cepStatus)}</p>`;

  const modeFields = checkout.modo === "local"
    ? `<div class="field-row">
         <label class="field-group">
           <span class="legend">Como te chamamos? <span class="req">obrigatório</span></span>
           <input class="field" name="apelido" maxlength="30" autocomplete="off" placeholder="Primeiro nome ou apelido" value="${esc(checkout.apelido)}" required>
         </label>
         <label class="field-group field-group--narrow">
           <span class="legend">Mesa</span>
           <input class="field" name="mesa" maxlength="10" inputmode="numeric" autocomplete="off" placeholder="Opcional" value="${esc(checkout.mesa)}">
         </label>
       </div>`
    : `<label class="field-group">
         <span class="legend">Como te chamamos? <span class="req">obrigatório</span></span>
         <input class="field" name="apelido" maxlength="30" autocomplete="off" placeholder="Primeiro nome ou apelido" value="${esc(checkout.apelido)}" required>
       </label>
       ${cepField}
       ${bairroField}
       <div class="field-row">
         <label class="field-group">
           <span class="legend">Rua <span class="req">obrigatório</span></span>
           <input class="field" name="rua" maxlength="80" autocomplete="off" value="${esc(checkout.endereco.rua)}" required>
         </label>
         <label class="field-group field-group--narrow">
           <span class="legend">Nº <span class="req">*</span></span>
           <input class="field" name="numero" maxlength="10" autocomplete="off" value="${esc(checkout.endereco.numero)}" required>
         </label>
       </div>
       <div class="field-row">
         <label class="field-group">
           <span class="legend">Complemento</span>
           <input class="field" name="complemento" maxlength="40" autocomplete="off" value="${esc(checkout.endereco.complemento)}">
         </label>
         <label class="field-group">
           <span class="legend">Referência</span>
           <input class="field" name="referencia" maxlength="60" autocomplete="off" value="${esc(checkout.endereco.referencia)}">
         </label>
       </div>
       <p class="privacy-note">
         <span aria-hidden="true">🔒</span>
         Seu endereço não fica salvo em lugar nenhum: ele vai direto do seu celular para o nosso WhatsApp.
       </p>`;

  const blocked = !catalog.online
    ? `<p class="notice">Pedidos pelo site estão fora do ar. Chame a gente no <a href="https://wa.me/${esc(restaurantConfig.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>.</p>`
    : !status.open
    ? `<p class="notice">Estamos fechados agora${status.opensAt ? ` e abrimos às ${esc(status.opensAt)}` : ""}. Dá para montar a comanda, mas o envio só abre no horário.</p>`
    : "";

  body.innerHTML = `
    <header class="ticket-head">
      <span class="ticket-kicker">Comanda</span>
      <h3 class="ticket-title">${esc(restaurantConfig.name)}</h3>
    </header>

    <ul class="ticket-items">${itemsHTML}</ul>

    <form id="checkout-form" class="ticket-form" novalidate>
      <fieldset class="field-group">
        <legend>Como você vai receber?</legend>
        <div class="segmented" role="radiogroup">
          <label class="segment">
            <input type="radio" name="modo" value="local" ${checkout.modo === "local" ? "checked" : ""}>
            <span>Consumir aqui</span>
          </label>
          <label class="segment${deliveryAvailable() ? "" : " is-disabled"}">
            <input type="radio" name="modo" value="entrega" ${checkout.modo === "entrega" ? "checked" : ""} ${deliveryAvailable() ? "" : "disabled"}>
            <span>Entrega${deliveryAvailable() ? "" : " (pausada)"}</span>
          </label>
        </div>
      </fieldset>

      ${modeFields}

      <fieldset class="field-group">
        <legend>Pagamento</legend>
        <div class="pay-options">
          ${options.map(o => `
            <label class="pay-option">
              <input type="radio" name="pagamento" value="${o.id}" ${checkout.pagamento === o.id ? "checked" : ""}>
              <span class="pay-label">${esc(o.label)}</span>
              <span class="pay-hint">${esc(o.hint)}</span>
            </label>`).join("")}
        </div>
      </fieldset>

      <dl class="ticket-sum">
        <div><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
        ${checkout.modo === "entrega" ? `<div><dt>Entrega</dt><dd>${d.modo === "bairro" && !checkout.bairro ? "escolha o bairro" : fee > 0 ? money(fee) : "grátis"}</dd></div>` : ""}
        <div class="ticket-total"><dt>Total</dt><dd>${money(subtotal + fee)}</dd></div>
      </dl>

      ${blocked}
      <p class="form-error" id="checkout-error" role="alert"></p>

      <button type="submit" class="btn btn--ink btn--block" ${blocked || checkout.sending ? "disabled" : ""}>
        ${checkout.sending ? "Enviando…" : checkout.modo === "entrega" ? "Fazer pedido" : "Enviar para a cozinha"}
      </button>
    </form>`;

  attachOrderEvents(body);
}

function attachOrderEvents(body) {
  body.querySelectorAll("[data-qty]").forEach(btn =>
    btn.addEventListener("click", () => { changeQty(Number(btn.dataset.qty), Number(btn.dataset.delta)); renderOrderBody(); })
  );

  const form = document.getElementById("checkout-form");

  // Campos de texto: só atualiza o estado (sem re-render, para não perder o foco)
  form.addEventListener("input", e => {
    const { name, value } = e.target;
    if (name === "apelido" || name === "mesa") checkout[name] = value;
    if (name === "cep") {
      const digits = value.replace(/\D/g, "").slice(0, 8);
      e.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
      checkout.endereco.cep = e.target.value;
      if (digits.length === 8) lookupCep(digits);
      return;
    }
    if (name === "bairro" && e.target.tagName === "INPUT") checkout.bairro = value;
    if (name in checkout.endereco) checkout.endereco[name] = value;
  });

  // Escolhas que mudam valores/opções: re-render
  form.addEventListener("change", e => {
    const { name, value } = e.target;
    if (name === "modo") checkout.modo = value;
    else if (name === "pagamento") checkout.pagamento = value;
    else if (name === "bairro" && e.target.tagName === "SELECT") checkout.bairro = value;
    else return;
    renderOrderBody();
  });

  form.addEventListener("submit", e => { e.preventDefault(); submitOrder(); });
}

function validateCheckout() {
  const apelido = checkout.apelido.trim();
  if (apelido.length < 2) return "Diga como podemos te chamar.";
  if (checkout.modo === "entrega") {
    if (catalog.delivery.modo === "bairro" && !checkout.bairro) return "Escolha o seu bairro.";
    if (!checkout.endereco.rua.trim() || !checkout.endereco.numero.trim()) return "Preencha rua e número para a entrega.";
  }
  return "";
}

async function submitOrder() {
  const errorEl = document.getElementById("checkout-error");
  const problem = validateCheckout();
  if (problem) { errorEl.textContent = problem; return; }
  if (checkout.sending) return;

  checkout.sending = true;
  renderOrderBody();

  const fee = deliveryFee();
  const subtotal = round2(cartSubtotal());
  const code = shortOrderCode();

  // Exatamente estes campos — as regras do Firestore recusam qualquer outro.
  const order = {
    codigo: code,
    modo: checkout.modo,
    pagamento: checkout.pagamento,
    apelido: checkout.apelido.trim().slice(0, 30),
    mesa: checkout.modo === "local" ? checkout.mesa.trim().slice(0, 10) : "",
    bairro: checkout.modo === "entrega" ? (checkout.bairro || "").slice(0, 40) : "",
    itens: cart.items.map(i => ({
      nome: i.name.slice(0, 80),
      tamanho: i.size,
      adicionais: i.addons.map(a => a.name),
      obs: i.obs,
      qtd: i.qty,
      unit: round2(i.unit),
    })),
    subtotal,
    taxaEntrega: round2(fee),
    total: round2(subtotal + fee),
    status: "novo",
    pago: false,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const ref = await db.collection("pedidos").add(order);
    const whatsText = order.modo === "entrega" ? buildWhatsMessage(order) : "";
    wipeAddress();       // endereço já foi copiado para a mensagem; some da memória
    checkout.mesa = "";
    clearCart();
    startTracking({ id: ref.id, code, modo: order.modo, pagamento: order.pagamento, total: order.total, whatsText });
  } catch (err) {
    console.error(err);
    checkout.sending = false;
    renderOrderBody();
    document.getElementById("checkout-error").textContent =
      "Não conseguimos enviar o pedido. Confira sua internet e tente de novo.";
    return;
  }
  checkout.sending = false;
}

/* ---------------- CEP ---------------- */

const normalizeName = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Busca o endereço do CEP (ViaCEP; se falhar, BrasilAPI). Nada é gravado:
 *  o resultado só preenche os campos na tela. */
async function fetchCep(cep) {
  const withTimeout = url => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    return fetch(url, { signal: ctrl.signal, referrerPolicy: "no-referrer" }).finally(() => clearTimeout(t));
  };
  try {
    const r = await withTimeout(`https://viacep.com.br/ws/${cep}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { rua: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade && j.uf ? `${j.localidade}/${j.uf}` : "" };
  } catch {
    const r = await withTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("cep");
    const j = await r.json();
    return { rua: j.street || "", bairro: j.neighborhood || "", cidade: j.city && j.state ? `${j.city}/${j.state}` : "" };
  }
}

async function lookupCep(cep) {
  if (checkout.cepLookup === cep) return;
  checkout.cepLookup = cep;
  const statusEl = document.getElementById("cep-status");
  if (statusEl) statusEl.textContent = "Buscando endereço…";

  let found = null;
  try {
    found = await fetchCep(cep);
  } catch {
    checkout.cepStatus = "Não conseguimos consultar o CEP agora. Preencha o endereço à mão.";
    checkout.cepLookup = "";
    if (statusEl) statusEl.textContent = checkout.cepStatus;
    return;
  }
  if (checkout.endereco.cep.replace(/\D/g, "") !== cep) return; // o cliente já mudou o CEP

  if (!found) {
    checkout.endereco.cidade = "";
    checkout.cepStatus = "CEP não encontrado. Confira os números ou preencha o endereço à mão.";
  } else {
    if (found.rua) checkout.endereco.rua = found.rua;
    checkout.endereco.cidade = found.cidade;
    const d = catalog.delivery;
    if (d.modo === "bairro") {
      const match = (d.bairros || []).find(b => normalizeName(b.nome) === normalizeName(found.bairro));
      if (match) {
        checkout.bairro = match.nome;
        checkout.cepStatus = `${found.cidade} · entregamos no ${match.nome} (${money(match.taxa)})`;
      } else {
        checkout.bairro = ""; // não deixa a taxa de outro bairro selecionada
        checkout.cepStatus = found.bairro
          ? `${found.bairro} não está na nossa lista. Escolha o bairro mais próximo ou chame no WhatsApp.`
          : `${found.cidade}. Escolha o seu bairro na lista.`;
      }
    } else {
      if (found.bairro) checkout.bairro = found.bairro.slice(0, 40);
      checkout.cepStatus = found.cidade;
    }
  }

  renderOrderBody();
  // Rua veio do CEP? O próximo campo útil é o número.
  const next = document.querySelector(`#checkout-form [name="${found && found.rua ? "numero" : "rua"}"]`);
  next?.focus();
}

const round2 = n => Math.round(n * 100) / 100;

function buildWhatsMessage(order) {
  const e = checkout.endereco;
  const lines = [
    `*Pedido #${order.codigo}* — ${restaurantConfig.name}`,
    `Nome: ${order.apelido}`,
    "",
    ...order.itens.map(i => {
      const det = [i.tamanho, i.adicionais.join(", "), i.obs && `obs: ${i.obs}`].filter(Boolean).join(" · ");
      return `${i.qtd}x ${i.nome}${det ? ` (${det})` : ""}`;
    }),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Entrega: ${order.taxaEntrega > 0 ? money(order.taxaEntrega) : "grátis"}`,
    `*Total: ${money(order.total)}*`,
    `Pagamento: ${PAYMENT_LABELS[order.pagamento]}`,
    "",
    "*Endereço*",
    `${e.rua.trim()}, ${e.numero.trim()}${e.complemento.trim() ? ` — ${e.complemento.trim()}` : ""}`,
    order.bairro ? `Bairro: ${order.bairro}` : null,
    e.cidade.trim() ? `Cidade: ${e.cidade.trim()}` : null,
    e.cep.trim() ? `CEP: ${e.cep.trim()}` : null,
    e.referencia.trim() ? `Referência: ${e.referencia.trim()}` : null,
  ].filter(l => l !== null);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/* ---------------- Acompanhamento ---------------- */

const STATUS_FLOW = {
  local:   [["novo", "Recebido"], ["preparo", "Preparando"], ["pronto", "Pronto no balcão"], ["concluido", "Finalizado"]],
  entrega: [["novo", "Recebido"], ["preparo", "Preparando"], ["saiu", "Saiu para entrega"], ["concluido", "Entregue"]],
};

function startTracking(info) {
  activeOrder?.unsubscribe?.();
  activeOrder = { ...info, status: "novo", unsubscribe: null };
  activeOrder.unsubscribe = db.collection("pedidos").doc(info.id).onSnapshot(
    snap => {
      if (!snap.exists) return;
      activeOrder.status = snap.data().status;
      if (currentSheet === "tracking") renderTrackingBody();
      renderOrderBar();
    },
    err => console.warn("Acompanhamento indisponível:", err.message)
  );
  openTrackingSheet();
}

function openTrackingSheet() {
  currentSheet = "tracking";
  openSheet(`<div class="ticket ticket--done" id="tracking-body"></div>`, "Pedido enviado");
  renderTrackingBody();
}

function renderTrackingBody() {
  const body = document.getElementById("tracking-body");
  if (!body || !activeOrder) return;
  const o = activeOrder;
  const flow = STATUS_FLOW[o.modo];
  const idx = flow.findIndex(([s]) => s === o.status);
  const cancelled = o.status === "cancelado";

  const steps = cancelled
    ? `<p class="notice notice--off">Este pedido foi cancelado. Qualquer dúvida, chama a gente no WhatsApp.</p>`
    : `<ol class="steps">${flow.map(([, label], i) =>
        `<li class="step${i < idx ? " is-done" : ""}${i === idx ? " is-current" : ""}">${esc(label)}</li>`).join("")}</ol>`;

  const pix = o.modo === "entrega" && o.pagamento === "pix"
    ? (() => {
        const code = pixCopiaECola(restaurantConfig.pix, o.total, o.code);
        return `
          <div class="pix-box">
            <span class="pix-title">Pix de ${money(o.total)}</span>
            <code class="pix-code" id="pix-code"></code>
            <button type="button" class="btn btn--banana btn--block" data-copy-pix>Copiar código Pix</button>
            <span class="pix-meta">Recebedor: ${esc(restaurantConfig.pix.receiverName)} · Chave (${esc(restaurantConfig.pix.keyType)})</span>
          </div>`;
      })()
    : "";

  const nextStep = o.modo === "entrega"
    ? `<p class="done-lead"><strong>Falta um passo:</strong> envie o endereço pelo WhatsApp para a gente sair com o seu pedido.</p>
       ${pix}
       ${o.whatsText
         ? `<a class="btn btn--whats btn--block" data-send-whats target="_blank" rel="noopener" href="https://wa.me/${esc(restaurantConfig.whatsapp)}?text=${encodeURIComponent(o.whatsText)}">Enviar endereço no WhatsApp</a>`
         : `<p class="privacy-note">Endereço enviado ✓ (e já apagado deste aparelho).</p>`}
       ${o.pagamento === "maquininha" ? `<p class="hint">O entregador leva a maquininha. Débito ou crédito.</p>` : ""}`
    : `<p class="done-lead">Pague no caixa com <strong>${o.pagamento === "caixa_pix" ? "Pix" : "cartão"}</strong> e informe o código <strong>#${esc(o.code)}</strong>.</p>`;

  body.innerHTML = `
    <header class="ticket-head">
      <span class="ticket-kicker">Pedido enviado</span>
      <span class="order-code" aria-label="Código do pedido">#${esc(o.code)}</span>
      <span class="ticket-total-big">${money(o.total)}</span>
    </header>
    ${steps}
    ${nextStep}
    <button type="button" class="btn btn--ghost btn--block" data-sheet-close>Voltar ao cardápio</button>`;

  body.querySelector("[data-copy-pix]")?.addEventListener("click", async () => {
    const ok = await copyText(document.getElementById("pix-code").textContent);
    showToast(ok ? "Código Pix copiado" : "Toque e segure o código para copiar");
  });

  body.querySelector("[data-send-whats]")?.addEventListener("click", () => {
    // O link já foi aberto; agora a mensagem com o endereço some da memória.
    setTimeout(() => { if (activeOrder) { activeOrder.whatsText = ""; renderTrackingBody(); } }, 400);
  });
}
