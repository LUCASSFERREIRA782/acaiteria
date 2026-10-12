/**
 * catalog.js
 * -------------------------------------------------------
 * Carrega o cardápio do Firestore e monta o DOM. Se o banco
 * falhar ou estiver vazio, usa data/menu.js como reserva —
 * nesse modo o envio de pedidos fica desativado (sem banco,
 * o painel não receberia o pedido).
 * -------------------------------------------------------
 */

const catalog = {
  categorias: [],   // [{ nome, slug, produtos: [...] }]
  adicionais: [],   // [{ name, price, group }]
  delivery: { ativo: false, modo: "fixo", taxaFixa: 0, bairros: [] },
  online: false,    // true = veio do Firestore e aceita pedidos
};

async function loadCatalog() {
  try {
    if (typeof db === "undefined") throw new Error("Firebase indisponível");

    const [catsSnap, prodSnap, addonsDoc, deliveryDoc, lojaDoc] = await Promise.all([
      db.collection("categorias").orderBy("ordem").get(),
      db.collection("produtos").orderBy("ordem").get(),
      db.collection("config").doc("adicionais").get(),
      db.collection("config").doc("deliveryFees").get(),
      db.collection("config").doc("loja").get(),
    ]);
    if (lojaDoc.exists) applyStoreConfig(lojaDoc.data());
    if (catsSnap.empty) throw new Error("Cardápio vazio no Firestore");

    const produtos = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    catalog.categorias = catsSnap.docs.map(d => {
      const cat = d.data();
      return { nome: cat.nome, slug: cat.slug || d.id, produtos: produtos.filter(p => p.categoriaSlug === (cat.slug || d.id)) };
    });
    catalog.adicionais = addonsDoc.exists ? addonsDoc.data().itens || [] : [];
    if (deliveryDoc.exists) catalog.delivery = { ...catalog.delivery, ...deliveryDoc.data() };
    catalog.online = true;
  } catch (err) {
    console.warn("Usando cardápio local:", err.message);
    catalog.categorias = menu.categorias.map(c => ({
      ...c,
      produtos: c.produtos.map((p, i) => ({ id: `${c.slug}-${i}`, ...p })),
    }));
    catalog.adicionais = menu.adicionais;
    catalog.online = false;
  }
}

/** Dados da loja editados no painel (config/loja) sobrepõem o config.js. */
function applyStoreConfig(loja) {
  const cfg = restaurantConfig;
  if (loja.nome) { cfg.name = loja.nome; cfg.seo.title = `${loja.nome} — Açaiteria`; }
  if (loja.slogan) cfg.slogan = loja.slogan;
  if (loja.endereco) cfg.address = loja.endereco;
  if (loja.instagram) cfg.instagram = loja.instagram;
  if (Array.isArray(loja.horarios) && loja.horarios.length) cfg.hours = loja.horarios;
  if (Array.isArray(loja.whatsapps) && loja.whatsapps.length) {
    cfg.whatsapps = loja.whatsapps;
    cfg.whatsapp = loja.whatsapps[0].numero; // o primeiro é o contato do rodapé
  }
  cfg.statusManual = loja.statusManual || "auto";
}

/** Aberto agora? Respeita o "abrir/fechar agora" do painel. */
function storeStatus() {
  const manual = restaurantConfig.statusManual;
  if (manual === "fechado") return { open: false, manual: true };
  if (manual === "aberto") return { open: true, manual: true };
  return openStatus(restaurantConfig.hours);
}

function findProduct(id) {
  for (const cat of catalog.categorias) {
    const p = cat.produtos.find(x => x.id === id);
    if (p) return p;
  }
  return null;
}

/** Menor preço do produto — mostrado como "a partir de". */
function basePrice(p) {
  return p.sizes?.length ? Math.min(...p.sizes.map(s => Number(s.price))) : Number(p.price);
}

/* ---------------- Render ---------------- */

function renderIdentity() {
  const cfg = restaurantConfig;
  document.title = cfg.seo.title;
  document.querySelector('meta[name="description"]').setAttribute("content", cfg.seo.description);
  document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = cfg.name));
  document.querySelectorAll("[data-slogan]").forEach(el => (el.textContent = cfg.slogan));
  document.querySelectorAll("[data-address]").forEach(el => (el.textContent = cfg.address));
  document.querySelectorAll("[data-whats-link]").forEach(el => (el.href = `https://wa.me/${cfg.whatsapp}`));
  document.querySelectorAll("[data-instagram-link]").forEach(el => (el.href = cfg.instagram));

  const hoursEl = document.querySelector("[data-hours-list]");
  const todayIdx = new Date().getDay();
  hoursEl.innerHTML = cfg.hours
    .map(h => `
      <div class="hours-row${h.day === todayIdx ? " is-today" : ""}">
        <dt>${esc(h.label)}</dt>
        <dd>${h.open ? `${esc(h.open)} – ${esc(h.close)}` : "Fechado"}</dd>
      </div>`)
    .join("");

  const sticker = document.querySelector("[data-open-status]");
  const st = storeStatus();
  sticker.hidden = false;
  sticker.classList.toggle("is-closed", !st.open);
  sticker.textContent = st.manual ? (st.open ? "Aberto agora" : "Fechado agora") : openStatusText(st);
}

function renderCategoryNav() {
  const track = document.querySelector("#category-nav .cat-nav-track");
  track.innerHTML = catalog.categorias
    .filter(c => c.produtos.length)
    .map(c => `<button type="button" class="cat-chip" data-cat-link="${esc(c.slug)}">${esc(c.nome)}</button>`)
    .join("");
}

function renderFeatured() {
  const items = catalog.categorias.flatMap(c => c.produtos.filter(p => p.featured && p.available));
  const section = document.getElementById("destaques");
  if (!items.length) { section.hidden = true; return; }
  section.hidden = false;
  section.querySelector(".featured-track").innerHTML = items
    .map((p, i) => `
      <button type="button" class="feat-card feat-card--${i % 3}" data-product-id="${esc(p.id)}">
        <span class="feat-photo">${photoHTML(p)}</span>
        <span class="feat-name">${esc(p.name)}</span>
        <span class="feat-price">${p.sizes?.length ? "a partir de " : ""}${money(basePrice(p))}</span>
      </button>`)
    .join("");
}

function renderCategories() {
  const container = document.getElementById("menu-categories");
  if (!catalog.categorias.length) {
    container.innerHTML = `<p class="empty-state">O cardápio está sendo preparado. Volte daqui a pouquinho.</p>`;
    return;
  }

  const offline = catalog.online
    ? ""
    : `<p class="notice">Estamos sem conexão com o sistema de pedidos agora. Dá para ver o cardápio, e para pedir é só chamar no WhatsApp.</p>`;

  container.innerHTML = offline + catalog.categorias
    .filter(c => c.produtos.length)
    .map(cat => `
      <section class="category" id="cat-${esc(cat.slug)}">
        <h2 class="section-title"><span>${esc(cat.nome)}</span></h2>
        <div class="product-grid">${cat.produtos.map(productRowHTML).join("")}</div>
      </section>`)
    .join("");
}

function photoHTML(p) {
  const src = safeUrl(p.image);
  return src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`
    : `<span class="photo-fallback" aria-hidden="true"></span>`;
}

function productRowHTML(p) {
  const price = p.available
    ? `<span class="price">${p.sizes?.length ? `<small>a partir de</small> ` : ""}${money(basePrice(p))}</span>`
    : `<span class="price price--off">Esgotado</span>`;

  return `
    <button type="button" class="product${p.available ? "" : " is-off"}" data-product-id="${esc(p.id)}">
      <span class="product-photo">${photoHTML(p)}</span>
      <span class="product-info">
        <span class="product-name">${esc(p.name)}</span>
        ${p.description ? `<span class="product-desc">${esc(p.description)}</span>` : ""}
        ${price}
      </span>
      ${p.available ? `<span class="product-add" aria-hidden="true">+</span>` : ""}
    </button>`;
}
