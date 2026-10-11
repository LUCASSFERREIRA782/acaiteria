/**
 * scripts/set-admin.js
 * -------------------------------------------------------
 * Script de bootstrap: cria (ou localiza) um usuário e define
 * o custom claim { admin: true } que as Security Rules usam
 * pra liberar escrita em /produtos, /categorias, /config.
 *
 * Rode UMA vez pra criar o primeiro admin. Depois disso, use
 * a Cloud Function `concederAdmin` (opção B) pra dar admin a
 * outras pessoas sem precisar do service account de novo.
 *
 * USO:
 *   1. npm install  (dentro de scripts/)
 *   2. Coloque o service-account.json nesta pasta
 *   3. node set-admin.js email@dominio.com "Nome do Admin"
 * -------------------------------------------------------
 */

// firebase-admin v12+ usa a API modular (o antigo admin.credential foi removido na v14)
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const path = require("path");

// ---- 1. Inicializa o Admin SDK ----
const serviceAccount = require(path.resolve(__dirname, "service-account.json"));

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();

// ---- 2. Lê os argumentos ----
const email = process.argv[2];
const displayName = process.argv[3] || "";
const password = process.argv[4]; // opcional — se não passar, gera aleatória

if (!email) {
  console.error("❌ Uso: node set-admin.js <email> [nome] [senha]");
  process.exit(1);
}

async function setAdmin() {
  console.log(`\n🔧 Definindo admin: ${email}\n`);

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`✓ Usuário já existe — UID: ${user.uid}`);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;

    const senhaInicial = password || gerarSenhaForte();
    user = await auth.createUser({
      email,
      password: senhaInicial,
      displayName,
      emailVerified: false,
    });
    console.log(`✓ Usuário criado — UID: ${user.uid}`);
    console.log(`  Senha inicial: ${senhaInicial}`);
    console.log(`  ⚠️  Peça pra ele trocar no primeiro acesso.`);
  }

  // ---- 3. Define o custom claim ----
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`✓ Custom claim { admin: true } aplicado.`);

  // ---- 4. Cria o documento na coleção admins (pra auditoria) ----
  await getFirestore().collection("admins").doc(user.uid).set(
    {
      email,
      displayName: displayName || user.displayName || "",
      concedidoEm: FieldValue.serverTimestamp(),
      concedidoPor: "script-local",
    },
    { merge: true }
  );
  console.log(`✓ Documento em /admins/${user.uid} criado.`);

  console.log(`\n✅ Pronto! Avise ${email} pra fazer login em /admin/.\n`);
}

function gerarSenhaForte() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

setAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ Erro:", err.message || err);
    process.exit(1);
  });