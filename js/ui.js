/**
 * ui.js
 * -------------------------------------------------------
 * Sheet genérico (produto, comanda e confirmação usam o
 * mesmo container), montagem do copo e navegação.
 * -------------------------------------------------------
 */

let lastFocus = null;

function openSheet(html, label = "Detalhes") {
  const overlay = document.getElementById("sheet-overlay");
  const sheet = document.getElementById("sheet");
  lastFocus = document.activeElement;
  sheet.innerHTML = `<button type="button" class="sheet-close" data-sheet-close aria-label="Fechar">✕</button>${html}`;
  sheet.setAttribute("aria-label", label);
  sheet.scrollTop = 0;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  sheet.focus({ preventScroll: true });
}

function closeSheet() {
  const overlay = document.getElementById("sheet-overlay");
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  if (typeof onSheetClosed === "function") onSheetClosed();
  lastFocus?.focus?.({ preventScroll: true });
}

function setupGlobalEvents() {
  const overlay = document.getElementById("sheet-overlay");

  document.addEventListener("click", e => {
    const productBtn = e.target.closest("[data-product-id]");
    if (productBtn) {
      const p = findProduct(productBtn.dataset.productId);
      if (p) openProductBuilder(p);
      return;
    }
    if (e.target.closest("[data-open-order]")) { openOrderSheet(); return; }
    if (e.target.closest("[data-sheet-close]") || e.target === overlay) closeSheet();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeSheet();
  });
}

/* ---------------- Montagem do copo ---------------- */

function openProductBuilder(p) {
  const sizes = p.sizes?.length ? p.sizes : null;
  const addons = p.addons ? catalog.adicionais : [];
  const groups = [...new Set(addons.map(a => a.group || "Adicionais"))];
  const src = safeUrl(p.image);

  const sizesHTML = sizes
    ? `<fieldset class="field-group">
         <legend>Tamanho <span class="req">obrigatório</span></legend>
         <div class="size-options">
           ${sizes.map((s, i) => `
             <label class="size-option">
               <input type="radio" name="size" value="${i}" ${i === 0 ? "checked" : ""}>
               <span class="size-cup size-cup--${Math.min(i, 2)}" aria-hidden="true"></span>
               <span class="size-label">${esc(s.label)}</span>
               <span class="size-price">${money(s.price)}</span>
             </label>`).join("")}
         </div>
       </fieldset>`
    : "";

  const addonsHTML = addons.length
    ? groups.map(g => `
        <fieldset class="field-group">
          <legend>${esc(g)}</legend>
          <div class="addon-list">
            ${addons.map((a, i) => (a.group || "Adicionais") !== g ? "" : `
              <label class="addon">
                <input type="checkbox" name="addon" value="${i}">
                <span class="addon-box" aria-hidden="true"></span>
                <span class="addon-name">${esc(a.name)}</span>
                <span class="addon-price">${Number(a.price) > 0 ? `+ ${money(a.price)}` : "grátis"}</span>
              </label>`).join("")}
          </div>
        </fieldset>`).join("")
    : "";

  const builder = p.available
    ? `<form class="builder" id="builder" novalidate>
         ${sizesHTML}
         ${addonsHTML}
         <label class="field-group">
           <span class="legend">Alguma observação?</span>
           <textarea class="field" name="obs" rows="2" maxlength="120" placeholder="Ex.: caprichar na granola, sem talher"></textarea>
         </label>
         <div class="builder-footer">
           <div class="stepper" role="group" aria-label="Quantidade">
             <button type="button" data-step="-1" aria-label="Diminuir">−</button>
             <output name="qty">1</output>
             <button type="button" data-step="1" aria-label="Aumentar">+</button>
           </div>
           <button type="submit" class="btn btn--banana btn--grow">
             Adicionar <span data-builder-total>${money(basePrice(p))}</span>
           </button>
         </div>
       </form>`
    : `<p class="notice notice--off">Esgotado por hoje. Que tal outro sabor?</p>`;

  openSheet(`
    <div class="sheet-hero${src ? "" : " sheet-hero--empty"}">
      ${src ? `<img src="${esc(src)}" alt="${esc(p.name)}">` : `<span class="photo-fallback photo-fallback--big" aria-hidden="true"></span>`}
    </div>
    <div class="sheet-body">
      <h3 class="sheet-title">${esc(p.name)}</h3>
      ${p.description ? `<p class="sheet-desc">${esc(p.description)}</p>` : ""}
      ${builder}
    </div>`, p.name);

  if (!p.available) return;

  const form = document.getElementById("builder");
  let qty = 1;

  const compute = () => {
    const sizeIdx = sizes ? Number(form.querySelector('input[name="size"]:checked').value) : -1;
    const chosen = [...form.querySelectorAll('input[name="addon"]:checked')].map(c => addons[Number(c.value)]);
    const unit = (sizes ? Number(sizes[sizeIdx].price) : Number(p.price)) + chosen.reduce((s, a) => s + Number(a.price || 0), 0);
    return { sizeIdx, chosen, unit };
  };
  const refresh = () => {
    form.querySelector("[data-builder-total]").textContent = money(compute().unit * qty);
    form.querySelector('output[name="qty"]').textContent = qty;
  };

  form.addEventListener("change", refresh);
  form.querySelectorAll("[data-step]").forEach(b =>
    b.addEventListener("click", () => { qty = Math.max(1, Math.min(20, qty + Number(b.dataset.step))); refresh(); })
  );
  form.addEventListener("submit", e => {
    e.preventDefault();
    const { sizeIdx, chosen, unit } = compute();
    const added = addToCart({
      productId: p.id,
      name: p.name,
      size: sizes ? sizes[sizeIdx].label : "",
      addons: chosen.map(a => ({ name: a.name, price: Number(a.price || 0) })),
      obs: form.obs.value.trim().slice(0, 120),
      qty,
      unit,
    });
    if (!added) { showToast("Máximo de 10 itens diferentes por comanda"); return; }
    closeSheet();
    showToast(`${p.name} foi para a comanda`);
  });
  refresh();
}

/* ---------------- Navegação ---------------- */

function setupCategoryNav() {
  const nav = document.getElementById("category-nav");
  const sections = [...document.querySelectorAll(".category")];

  nav.addEventListener("click", e => {
    const btn = e.target.closest("[data-cat-link]");
    if (!btn) return;
    document.getElementById(`cat-${btn.dataset.catLink}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (!("IntersectionObserver" in window) || !sections.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const slug = entry.target.id.replace("cat-", "");
      nav.querySelectorAll(".cat-chip").forEach(b => {
        const active = b.dataset.catLink === slug;
        b.classList.toggle("is-active", active);
        if (active) b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(s => observer.observe(s));
}

function setupReveal() {
  const els = document.querySelectorAll(".product, .feat-card");
  if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("is-in")); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px 80px 0px" });
  els.forEach(el => io.observe(el));
}
