/**
 * app.js
 * -------------------------------------------------------
 * Ponto de entrada: identidade → cardápio → comportamentos.
 * -------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", async () => {
  renderIdentity();
  setupGlobalEvents();

  // Foto com URL quebrada vira a ilustração padrão em vez do ícone de erro
  document.addEventListener("error", e => {
    if (e.target.tagName === "IMG") {
      const ph = document.createElement("span");
      ph.className = "photo-fallback";
      e.target.replaceWith(ph);
    }
  }, true);

  await loadCatalog();
  renderCategoryNav();
  renderFeatured();
  renderCategories();

  setupCategoryNav();
  setupReveal();
  renderOrderBar();
});
