/**
 * admin-users.js
 * Administradores: concede/revoga acesso via Cloud Functions.
 */

function initAdminsAdmin() {
  document.getElementById("grant-admin-form").addEventListener("submit", grantAdmin);
  document.getElementById("admins-list").addEventListener("click", revokeAdmin);
  loadAdmins();
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
    alert("Erro: " + serverMessage(err));
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
    alert("Erro: " + serverMessage(err));
  }
}

// Limpeza de dados: movida para admin-reports.js (aba "Relatórios e dados").
