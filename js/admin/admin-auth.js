/**
 * admin-auth.js
 * Login (e-mail/senha do Firebase Auth) + troca de abas.
 * Só entra quem tem o claim { admin: true } — conta comum
 * é desconectada na hora.
 */

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
let adminStarted = false;

document.querySelectorAll("[data-brand-name]").forEach(el => (el.textContent = restaurantConfig.name));

if (location.protocol === "file:") {
  document.getElementById("login-error").textContent =
    "O painel não funciona aberto direto do arquivo. Use um servidor (ex.: npx http-server) ou o site publicado.";
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    loginScreen.hidden = false;
    adminPanel.hidden = true;
    return;
  }
  const token = await user.getIdTokenResult(true);
  if (!token.claims.admin) {
    document.getElementById("login-error").textContent =
      "Esta conta não tem acesso ao painel. Peça a um administrador para liberar.";
    await auth.signOut();
    return;
  }
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  if (!adminStarted) {
    adminStarted = true;
    initOrdersAdmin();
    initProductsAdmin();
    initAddonsAdmin();
    initDeliveryAdmin();
    initAdminsAdmin();
  }
  startOrdersListener();
});

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  errorEl.textContent = "";
  btn.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
  } catch (err) {
    const msgs = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
      "auth/user-not-found": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/invalid-email": "E-mail inválido.",
      "auth/user-disabled": "Esta conta está desativada no Firebase.",
      "auth/too-many-requests": "Muitas tentativas. Tente de novo em alguns minutos ou redefina a senha.",
      "auth/operation-not-allowed": "Login por e-mail/senha está desativado no Firebase (Authentication → Sign-in method).",
      "auth/unauthorized-domain": `O domínio ${location.hostname} não está autorizado no Firebase (Authentication → Settings → Authorized domains).`,
      "auth/operation-not-supported-in-this-environment": "Abra o painel por um endereço http(s), não direto do arquivo.",
      "auth/network-request-failed": "Sem conexão com o Firebase. Verifique a internet.",
    };
    console.warn("Falha no login:", err.code, err.message);
    errorEl.textContent = `${msgs[err.code] || "Não foi possível entrar."} (${err.code || "erro desconhecido"})`;
  } finally {
    btn.disabled = false;
    document.getElementById("password").value = "";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  stopOrdersListener();
  auth.signOut();
});

// Abas
document.querySelectorAll(".a-tab").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".a-tab").forEach(b => b.classList.toggle("is-active", b === btn));
    document.querySelectorAll(".a-pane").forEach(p => p.classList.toggle("is-active", p.id === `tab-${btn.dataset.tab}`));
  })
);

// Fechar modais
document.querySelectorAll("[data-close-modal]").forEach(btn =>
  btn.addEventListener("click", () => btn.closest("dialog").close())
);

const ts = () => firebase.firestore.FieldValue.serverTimestamp();
