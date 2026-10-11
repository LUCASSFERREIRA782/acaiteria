/**
 * admin-products.js
 * -------------------------------------------------------
 * Categorias e produtos (com foto, tamanhos e adicionais).
 * A foto é redimensionada no navegador (máx. 1200 px, WebP)
 * antes de subir para o Firebase Storage.
 * -------------------------------------------------------
 */

let categoriesCache = [];
let productsCache = [];
let editingImageUrl = "";
let editingImageBlob = null;
let removeImage = false;

function initProductsAdmin() {
  document.getElementById("new-product-btn").addEventListener("click", () => openProductModal());
  document.getElementById("new-category-btn").addEventListener("click", () => openCategoryModal());
  document.getElementById("product-image").addEventListener("change", onImageChosen);
  document.getElementById("remove-image-btn").addEventListener("click", () => {
    editingImageBlob = null;
    removeImage = true;
    setPreview("");
  });
  document.getElementById("add-size-btn").addEventListener("click", () => addSizeRow());
  document.getElementById("product-form").addEventListener("submit", saveProduct);
  document.getElementById("category-form").addEventListener("submit", saveCategory);
  document.getElementById("category-delete-btn").addEventListener("click", deleteCategory);
  document.getElementById("products-list").addEventListener("click", onProductsListClick);
  loadMenuAdmin();
}

async function loadMenuAdmin() {
  const wrap = document.getElementById("products-list");
  wrap.innerHTML = `<p class="a-hint">Carregando…</p>`;
  const [cats, prods] = await Promise.all([
    db.collection("categorias").orderBy("ordem").get(),
    db.collection("produtos").orderBy("ordem").get(),
  ]);
  categoriesCache = cats.docs.map(d => ({ id: d.id, ...d.data() }));
  productsCache = prods.docs.map(d => ({ id: d.id, ...d.data() }));

  document.getElementById("product-category").innerHTML = categoriesCache
    .map(c => `<option value="${esc(c.slug || c.id)}">${esc(c.nome)}</option>`).join("");

  if (!categoriesCache.length) {
    wrap.innerHTML = `<p class="a-empty">Nenhuma categoria ainda. Crie uma em "+ Categoria" ou rode o data/seed.js.</p>`;
    return;
  }

  const orphan = productsCache.filter(p => !categoriesCache.some(c => (c.slug || c.id) === p.categoriaSlug));
  const groups = [...categoriesCache.map(c => ({ cat: c, items: productsCache.filter(p => p.categoriaSlug === (c.slug || c.id)) }))];
  if (orphan.length) groups.push({ cat: { id: "", nome: "Sem categoria" }, items: orphan });

  wrap.innerHTML = groups.map(({ cat, items }) => `
    <section class="a-cat">
      <header class="a-cat-head">
        <h3>${esc(cat.nome)} <small>${items.length}</small></h3>
        ${cat.id ? `<button type="button" class="a-btn a-btn--ghost a-btn--xs" data-edit-cat="${esc(cat.id)}">Editar categoria</button>` : ""}
      </header>
      ${items.length ? items.map(productRowAdminHTML).join("") : `<p class="a-empty">Nenhum produto nesta categoria.</p>`}
    </section>`).join("");
}

function productRowAdminHTML(p) {
  const src = safeUrl(p.image);
  const price = p.sizes?.length
    ? p.sizes.map(s => `${esc(s.label)} ${money(s.price)}`).join(" · ")
    : money(p.price);
  return `
    <div class="a-prod${p.available ? "" : " is-off"}" data-id="${esc(p.id)}">
      <div class="a-prod-thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span>sem foto</span>`}</div>
      <div class="a-prod-info">
        <strong>${esc(p.name)}</strong>
        <span class="a-prod-price">${price}</span>
        <span class="a-prod-flags">
          ${p.featured ? `<span class="o-tag">Destaque</span>` : ""}
          ${p.addons ? `<span class="o-tag">Adicionais</span>` : ""}
        </span>
      </div>
      <label class="a-switch a-switch--compact" title="Disponível">
        <input type="checkbox" data-toggle-available ${p.available ? "checked" : ""}><span>${p.available ? "Disponível" : "Esgotado"}</span>
      </label>
      <div class="a-prod-actions">
        <button type="button" class="a-btn a-btn--xs" data-action="edit">Editar</button>
        <button type="button" class="a-btn a-btn--ghost a-btn--xs" data-action="delete">Excluir</button>
      </div>
    </div>`;
}

async function onProductsListClick(e) {
  const catBtn = e.target.closest("[data-edit-cat]");
  if (catBtn) { openCategoryModal(catBtn.dataset.editCat); return; }

  const row = e.target.closest("[data-id]");
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.matches("[data-toggle-available]")) {
    await db.collection("produtos").doc(id).update({ available: e.target.checked, atualizadoEm: ts() });
    showToast(e.target.checked ? "Produto disponível" : "Produto marcado como esgotado");
    loadMenuAdmin();
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "edit") openProductModal(id);
  if (action === "delete") deleteProduct(id);
}

/* ---------------- Produto ---------------- */

function setPreview(src) {
  document.getElementById("image-preview").innerHTML = src ? `<img src="${esc(src)}" alt="">` : `<span>sem foto</span>`;
}

function addSizeRow(label = "", price = "") {
  const row = document.createElement("div");
  row.className = "a-row";
  row.innerHTML = `
    <input class="f-input" placeholder="Ex.: 500 ml" maxlength="30" data-size-label value="${esc(label)}">
    <input class="f-input" type="number" step="0.10" min="0" placeholder="R$" data-size-price value="${esc(price)}">
    <button type="button" class="a-icon-btn" aria-label="Remover tamanho">✕</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  document.getElementById("sizes-list").appendChild(row);
}

function openProductModal(id = null) {
  const form = document.getElementById("product-form");
  form.reset();
  editingImageUrl = "";
  editingImageBlob = null;
  removeImage = false;
  document.getElementById("sizes-list").innerHTML = "";
  document.getElementById("product-error").textContent = "";

  const p = id ? productsCache.find(x => x.id === id) : null;
  document.getElementById("modal-title").textContent = p ? "Editar produto" : "Novo produto";
  document.getElementById("product-id").value = p ? id : "";
  document.getElementById("product-name").value = p?.name || "";
  document.getElementById("product-description").value = p?.description || "";
  document.getElementById("product-price").value = p?.price ?? "";
  if (p) document.getElementById("product-category").value = p.categoriaSlug;
  document.getElementById("product-addons").checked = Boolean(p?.addons);
  document.getElementById("product-available").checked = p ? Boolean(p.available) : true;
  document.getElementById("product-featured").checked = Boolean(p?.featured);
  (p?.sizes || []).forEach(s => addSizeRow(s.label, s.price));
  editingImageUrl = safeUrl(p?.image);
  setPreview(editingImageUrl);

  document.getElementById("product-modal").showModal();
}

async function onImageChosen(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { alert("Use uma foto JPG, PNG ou WebP."); return; }
  try {
    editingImageBlob = await compressImage(file, 1200, 0.82);
    removeImage = false;
    setPreview(URL.createObjectURL(editingImageBlob));
  } catch {
    alert("Não foi possível ler esta imagem.");
  }
}

/** Redimensiona e converte para WebP (cai para JPEG se o navegador não suportar). */
function compressImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(blob => {
        if (blob && blob.type === "image/webp") return resolve(blob);
        canvas.toBlob(b => (b ? resolve(b) : reject()), "image/jpeg", quality);
      }, "image/webp", quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function deleteStoredImage(url) {
  if (!url || !url.includes("firebasestorage")) return;
  try { await storage.refFromURL(url).delete(); } catch (err) { console.warn("Foto antiga não removida:", err.message); }
}

async function saveProduct(e) {
  e.preventDefault();
  const errorEl = document.getElementById("product-error");
  const btn = document.getElementById("product-save-btn");
  errorEl.textContent = "";

  const sizes = [...document.querySelectorAll("#sizes-list .a-row")]
    .map(r => ({ label: r.querySelector("[data-size-label]").value.trim(), price: parseFloat(r.querySelector("[data-size-price]").value) }))
    .filter(s => s.label && !Number.isNaN(s.price));

  const id = document.getElementById("product-id").value;
  const name = document.getElementById("product-name").value.trim();
  let price = parseFloat(document.getElementById("product-price").value);
  if (sizes.length) price = Math.min(...sizes.map(s => s.price));
  if (!name) { errorEl.textContent = "Dê um nome ao produto."; return; }
  if (Number.isNaN(price)) { errorEl.textContent = "Informe o preço ou ao menos um tamanho."; return; }

  const data = {
    name,
    description: document.getElementById("product-description").value.trim(),
    price,
    sizes,
    categoriaSlug: document.getElementById("product-category").value,
    addons: document.getElementById("product-addons").checked,
    available: document.getElementById("product-available").checked,
    featured: document.getElementById("product-featured").checked,
    atualizadoEm: ts(),
  };

  btn.disabled = true;
  btn.textContent = editingImageBlob ? "Enviando foto…" : "Salvando…";
  try {
    if (editingImageBlob) {
      const ext = editingImageBlob.type === "image/webp" ? "webp" : "jpg";
      const ref = storage.ref(`produtos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
      await ref.put(editingImageBlob, { contentType: editingImageBlob.type, cacheControl: "public, max-age=31536000" });
      data.image = await ref.getDownloadURL();
      if (editingImageUrl) deleteStoredImage(editingImageUrl);
    } else if (removeImage) {
      data.image = "";
      if (editingImageUrl) deleteStoredImage(editingImageUrl);
    } else {
      data.image = editingImageUrl;
    }

    if (id) {
      await db.collection("produtos").doc(id).update(data);
    } else {
      data.criadoEm = ts();
      data.ordem = Date.now();
      await db.collection("produtos").add(data);
    }
    document.getElementById("product-modal").close();
    showToast("Produto salvo");
    loadMenuAdmin();
  } catch (err) {
    errorEl.textContent = "Erro ao salvar: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar";
  }
}

async function deleteProduct(id) {
  const p = productsCache.find(x => x.id === id);
  if (!confirm(`Excluir "${p?.name}"? Essa ação não pode ser desfeita.`)) return;
  await db.collection("produtos").doc(id).delete();
  deleteStoredImage(p?.image);
  showToast("Produto excluído");
  loadMenuAdmin();
}

/* ---------------- Categoria ---------------- */

const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function openCategoryModal(id = null) {
  const c = id ? categoriesCache.find(x => x.id === id) : null;
  document.getElementById("category-modal-title").textContent = c ? "Editar categoria" : "Nova categoria";
  document.getElementById("category-id").value = c ? id : "";
  document.getElementById("category-name").value = c?.nome || "";
  document.getElementById("category-order").value = c?.ordem ?? categoriesCache.length;
  document.getElementById("category-delete-btn").hidden = !c;
  document.getElementById("category-modal").showModal();
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById("category-id").value;
  const nome = document.getElementById("category-name").value.trim();
  if (!nome) return;
  const ordem = parseInt(document.getElementById("category-order").value, 10) || 0;

  if (id) {
    await db.collection("categorias").doc(id).update({ nome, ordem });
  } else {
    const slug = slugify(nome) || `cat-${Date.now()}`;
    if (categoriesCache.some(c => (c.slug || c.id) === slug)) { alert("Já existe uma categoria com esse nome."); return; }
    await db.collection("categorias").doc(slug).set({ nome, slug, ordem });
  }
  document.getElementById("category-modal").close();
  showToast("Categoria salva");
  loadMenuAdmin();
}

async function deleteCategory() {
  const id = document.getElementById("category-id").value;
  const c = categoriesCache.find(x => x.id === id);
  const count = productsCache.filter(p => p.categoriaSlug === (c.slug || c.id)).length;
  if (count) { alert(`Mova ou exclua os ${count} produto(s) desta categoria antes.`); return; }
  if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
  await db.collection("categorias").doc(id).delete();
  document.getElementById("category-modal").close();
  loadMenuAdmin();
}
