/**
 * app.js
 * -------------------------------------------------------
 * Ponto de entrada: identidade → cardápio → comportamentos.
 * -------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", async () => {
  renderIdentity();
  setupGlobalEvents();

  // Topo 3D (foto real com profundidade) depois que o resto já está na tela
  const stage = document.getElementById("hero-stage");
  const semWebGL = () => { stage.innerHTML = `<div class="hero-stage-fallback" aria-hidden="true"></div>`; };
  const start3D = () => startPhoto3D(stage, "assets/hero/acai.webp", semWebGL);
  ("requestIdleCallback" in window) ? requestIdleCallback(start3D, { timeout: 1200 }) : setTimeout(start3D, 300);

  // Foto com URL quebrada vira a ilustração padrão em vez do ícone de erro
  document.addEventListener("error", e => {
    if (e.target.tagName === "IMG") {
      const ph = document.createElement("span");
      ph.className = "photo-fallback";
      e.target.replaceWith(ph);
    }
  }, true);

  await loadCatalog();
  renderIdentity(); // agora com horários/WhatsApp/nome vindos do painel
  renderCategoryNav();
  renderFeatured();
  renderCategories();

  setupCategoryNav();
  setupReveal();
  renderOrderBar();
});
