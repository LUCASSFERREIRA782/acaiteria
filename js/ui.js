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
      ${src
        ? `<button type="button" class="sheet-hero-zoom" data-zoom-photo aria-label="Ampliar a foto de ${esc(p.name)}">
             <img src="${esc(src)}" alt="${esc(p.name)}">
             <span class="zoom-badge" aria-hidden="true">⤢ Ver foto</span>
           </button>`
        : `<span class="photo-fallback photo-fallback--big" aria-hidden="true"></span>`}
    </div>
    <div class="sheet-body">
      <h3 class="sheet-title">${esc(p.name)}</h3>
      ${p.description ? `<p class="sheet-desc">${esc(p.description)}</p>` : ""}
      ${builder}
    </div>`, p.name);

  document.querySelector("[data-zoom-photo]")?.addEventListener("click", () => openPhotoViewer(src, p.name));
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
  const track = nav.querySelector(".cat-nav-track");
  const sections = [...document.querySelectorAll(".category")];
  let jumpingUntil = 0; // durante o "pulo" do clique, o destaque não muda

  const setActive = slug => {
    nav.querySelectorAll(".cat-chip").forEach(b => {
      const active = b.dataset.catLink === slug;
      b.classList.toggle("is-active", active);
      // Desliza SÓ a barra de categorias (na horizontal). Não usar
      // scrollIntoView aqui: ele também mexe na rolagem da página e
      // trava o dedo/mouse do cliente a cada categoria que passa.
      if (active) {
        const left = b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2;
        track.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      }
    });
  };

  nav.addEventListener("click", e => {
    const btn = e.target.closest("[data-cat-link]");
    if (!btn) return;
    const section = document.getElementById(`cat-${btn.dataset.catLink}`);
    if (!section) return;
    // Altura que fica fixa no topo DEPOIS da rolagem (topo + barra de categorias),
    // e não a posição atual da barra, que ainda está abaixo do banner.
    const offset = (parseFloat(getComputedStyle(nav).top) || 0) + nav.offsetHeight + 8;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;
    jumpingUntil = Date.now() + 900;
    setActive(btn.dataset.catLink);
    window.scrollTo({ top, behavior: "smooth" });
  });

  if (!("IntersectionObserver" in window) || !sections.length) return;
  const observer = new IntersectionObserver(entries => {
    if (Date.now() < jumpingUntil) return;
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id.replace("cat-", ""));
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

/* ---------------- Foto em tela cheia (com zoom) ----------------
 * Toque/clique na foto do produto abre em tela cheia.
 * Celular: pinça para aproximar, arrasta para mover, toque duplo alterna o zoom.
 * Computador: clique alterna o zoom (no ponto clicado), arrastar move, roda do mouse aproxima.
 * Fecha no ✕, no Esc ou tocando fora da foto.
 */
function openPhotoViewer(src, name) {
  const safe = safeUrl(src);
  if (!safe) return;
  const back = document.activeElement;
  const viewer = document.createElement("div");
  viewer.className = "photo-viewer";
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", `Foto: ${name}`);
  viewer.innerHTML = `
    <img class="photo-viewer-img" src="${esc(safe)}" alt="${esc(name)}" draggable="false">
    <button type="button" class="photo-viewer-close" aria-label="Fechar foto">✕</button>
    <p class="photo-viewer-hint">${matchMedia("(hover: hover)").matches ? "Clique para aproximar · arraste para mover" : "Pince para aproximar · toque duplo"}</p>`;
  document.body.appendChild(viewer);
  const img = viewer.querySelector("img");
  const closeBtn = viewer.querySelector(".photo-viewer-close");

  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let pinchStart = null, panStart = null, moved = false, lastTap = 0;

  const clampPan = () => {
    const r = img.getBoundingClientRect();
    const w = (r.width / scale) * (scale - 1) / 2, h = (r.height / scale) * (scale - 1) / 2;
    x = Math.max(-w, Math.min(w, x)); y = Math.max(-h, Math.min(h, y));
  };
  const apply = (animate = false) => {
    if (scale <= 1.01) { scale = 1; x = 0; y = 0; }
    clampPan();
    img.style.transition = animate ? "transform .22s ease" : "none";
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    viewer.classList.toggle("is-zoomed", scale > 1);
  };
  const zoomAt = (clientX, clientY, target) => {
    const r = img.getBoundingClientRect();
    const cx = clientX - (r.left + r.width / 2), cy = clientY - (r.top + r.height / 2);
    const k = target / scale;
    x = (x - cx) * k + cx; y = (y - cy) * k + cy;
    scale = target;
    apply(true);
  };

  img.addEventListener("pointerdown", e => {
    try { img.setPointerCapture(e.pointerId); } catch { /* alguns navegadores recusam: segue sem captura */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), scale };
    } else {
      panStart = { px: e.clientX, py: e.clientY, x, y };
    }
  });
  img.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      scale = Math.max(1, Math.min(4, pinchStart.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.d));
      moved = true;
      apply();
    } else if (panStart && scale > 1) {
      const dx = e.clientX - panStart.px, dy = e.clientY - panStart.py;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      x = panStart.x + dx; y = panStart.y + dy;
      apply();
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 1) { const [p] = pointers.values(); panStart = { px: p.x, py: p.y, x, y }; }
    if (pointers.size === 0) panStart = null;
  };
  img.addEventListener("pointerup", e => {
    end(e);
    if (moved) return;
    const now = Date.now();
    const isTouch = e.pointerType !== "mouse";
    if (!isTouch || now - lastTap < 300) zoomAt(e.clientX, e.clientY, scale > 1 ? 1 : 2.5);
    lastTap = now;
  });
  img.addEventListener("pointercancel", end);
  img.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.max(1, Math.min(4, scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2))));
  }, { passive: false });

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    viewer.remove();
    back?.focus?.({ preventScroll: true });
  };
  const onKey = e => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); } // foco fica dentro da foto
  };
  document.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", close);
  viewer.addEventListener("click", e => { if (e.target === viewer) close(); });
  requestAnimationFrame(() => viewer.classList.add("is-open"));
  closeBtn.focus();
}
