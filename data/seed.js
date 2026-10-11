/**
 * data/seed.js
 * -------------------------------------------------------
 * Popula o Firestore com o cardápio de data/menu.js.
 *
 * Como usar (uma vez só):
 *   1. Entre no painel /admin com uma conta de administrador.
 *   2. Abra o console do navegador (F12) nessa mesma aba.
 *   3. Cole o conteúdo de data/menu.js e depois o deste arquivo.
 *
 * Atenção: APAGA as categorias e produtos atuais antes de gravar
 * (para não misturar com o cardápio antigo). Fotos já enviadas
 * ao Storage não são apagadas.
 * Este arquivo não é publicado no Hosting (ver firebase.json).
 * -------------------------------------------------------
 */

async function seedFirestore() {
  if (!confirm("Substituir TODO o cardápio do Firestore pelo de data/menu.js?")) return;

  const wipe = async name => {
    const snap = await db.collection(name).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  };
  await wipe("produtos");
  await wipe("categorias");

  const batch = db.batch();
  menu.categorias.forEach((cat, ci) => {
    batch.set(db.collection("categorias").doc(cat.slug), { nome: cat.nome, slug: cat.slug, ordem: ci });
    cat.produtos.forEach((p, pi) => {
      batch.set(db.collection("produtos").doc(), {
        name: p.name,
        description: p.description || "",
        price: p.price,
        sizes: p.sizes || [],
        addons: Boolean(p.addons),
        image: p.image || "",
        available: p.available !== false,
        featured: Boolean(p.featured),
        categoriaSlug: cat.slug,
        ordem: ci * 100 + pi,
      });
    });
  });
  batch.set(db.collection("config").doc("adicionais"), { itens: menu.adicionais });
  batch.set(db.collection("config").doc("deliveryFees"), {
    ativo: true,
    modo: "bairro",
    taxaFixa: 5,
    bairros: [
      { nome: "Vila Luzita", taxa: 4 },
      { nome: "Jardim", taxa: 6 },
    ],
  }, { merge: true });
  await batch.commit();

  console.log("✅ Cardápio da açaiteria gravado no Firestore.");
}

seedFirestore();
