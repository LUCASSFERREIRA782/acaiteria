/**
 * admin-users.js
 * Equipe (concede/revoga admin via Cloud Functions) e limpeza
 * de dados antigos — guardar só o necessário, pelo tempo necessário.
 */

function initAdminsAdmin() {
  document.getElementById("grant-admin-form").addEventListener("submit", grantAdmin);
  document.getElementById("admins-list").addEventListener("click", revokeAdmin);
  document.getElementById("purge-orders-btn").addEventListener("click", purgeOldOrders);
  document.getElementById("purge-legacy-btn").addEventListener("click", purgeLegacy);
  loadAdmins();
  countDataToPurge();
}

async function grantAdmin(e) {
  e.preventDefault();
  const input = document.getElementById("new-admin-email");
  const email = input.value.trim();
  if (!email) return;
  try {
    await firebase.functions().httpsCallable("concederAdmin")({ email });
    showToast(`${email} agora tem acesso`);
    input.value = "";
    loadAdmins();
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

async function loadAdmins() {
  const wrap = document.getElementById("admins-list");
  try {
    const snap = await db.collection("admins").orderBy("concedidoEm", "desc").get();
    wrap.innerHTML = snap.empty
      ? `<p class="a-empty">Nenhum administrador registrado (o primeiro é criado pelo scripts/set-admin.js).</p>`
      : snap.docs.map(d => {
          const a = d.data();
          const me = d.id === auth.currentUser?.uid;
          return `
            <div class="a-maint-row">
              <div><strong>${esc(a.displayName || a.email)}</strong><span class="a-hint">${esc(a.email)}${me ? " · você" : ""}</span></div>
              ${me ? "" : `<button type="button" class="a-btn a-btn--ghost a-btn--xs" data-uid="${esc(d.id)}">Revogar</button>`}
            </div>`;
        }).join("");
  } catch (err) {
    wrap.innerHTML = `<p class="a-error">${esc(err.message)}</p>`;
  }
}

async function revokeAdmin(e) {
  const btn = e.target.closest("[data-uid]");
  if (!btn || !confirm("Revogar o acesso desta pessoa?")) return;
  try {
    await firebase.functions().httpsCallable("revogarAdmin")({ uid: btn.dataset.uid });
    loadAdmins();
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

/* ---------- Limpeza ---------- */

function oldOrdersQuery() {
  const limit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.collection("pedidos").where("criadoEm", "<", limit).limit(400);
}

async function countDataToPurge() {
  try {
    const [old, tx, em] = await Promise.all([
      oldOrdersQuery().get(),
      db.collection("transacoes").limit(400).get(),
      db.collection("emails").limit(400).get(),
    ]);
    document.getElementById("old-orders-count").textContent = `${old.size}${old.size === 400 ? "+" : ""} pedido(s)`;
    const legacy = tx.size + em.size;
    document.getElementById("legacy-count").textContent = legacy
      ? `${legacy} registro(s) que podem conter endereço e e-mail de clientes`
      : "Nada para apagar ✓";
    document.getElementById("purge-legacy-btn").disabled = legacy === 0;
    document.getElementById("purge-orders-btn").disabled = old.size === 0;
  } catch (err) {
    console.warn(err);
  }
}

async function deleteDocs(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

async function purgeOldOrders() {
  if (!confirm("Apagar definitivamente os pedidos com mais de 30 dias?")) return;
  const snap = await oldOrdersQuery().get();
  await deleteDocs(snap.docs);
  showToast(`${snap.size} pedido(s) apagado(s)`);
  countDataToPurge();
}

async function purgeLegacy() {
  if (!confirm("Apagar definitivamente as transações e e-mails do sistema antigo? Eles podem conter endereço e e-mail de clientes.")) return;
  const [tx, em] = await Promise.all([
    db.collection("transacoes").limit(400).get(),
    db.collection("emails").limit(400).get(),
  ]);
  await deleteDocs([...tx.docs, ...em.docs]);
  showToast(`${tx.size + em.size} registro(s) apagado(s)`);
  countDataToPurge();
}
