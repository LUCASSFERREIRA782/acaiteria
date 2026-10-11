/**
 * functions/admins.js
 * -------------------------------------------------------
 * Funções administrativas que só um admin já autenticado
 * pode invocar. Usadas pra conceder/revogar o claim admin
 * sem precisar da service account local.
 * -------------------------------------------------------
 */

// API v1 (assinatura (data, context)) — no firebase-functions v6+ o import
// padrão é a API v2, que recebe um único objeto "request".
const functions = require("firebase-functions/v1");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * Concede { admin: true } a um usuário.
 * Só pode ser chamada por quem já tem o claim admin.
 */
exports.concederAdmin = functions.https.onCall(async (data, context) => {
  // ---- 1. Verifica autenticação ----
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar logado."
    );
  }

  // ---- 2. Verifica se quem chama é admin ----
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas admins podem conceder acesso a outros admins."
    );
  }

  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "E-mail obrigatório.");
  }

  // ---- 3. Localiza o usuário ----
  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      throw new functions.https.HttpsError(
        "not-found",
        `Nenhum usuário com o e-mail ${email}. Crie a conta antes.`
      );
    }
    throw err;
  }

  // ---- 4. Aplica o claim ----
  await getAuth().setCustomUserClaims(user.uid, { admin: true });

  // ---- 5. Auditoria ----
  await getFirestore().collection("admins").doc(user.uid).set(
    {
      email,
      displayName: user.displayName || "",
      concedidoEm: FieldValue.serverTimestamp(),
      concedidoPor: context.auth.token.email || context.auth.uid,
    },
    { merge: true }
  );

  return { success: true, uid: user.uid };
});

/**
 * Revoga o claim admin de um usuário.
 */
exports.revogarAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError("permission-denied", "Sem permissão.");
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");
  }

  // Impede o admin de revogar a si mesmo (evita se trancar pra fora)
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Você não pode revogar seu próprio acesso."
    );
  }

  await getAuth().setCustomUserClaims(uid, { admin: false });
  await getFirestore().collection("admins").doc(uid).delete();

  return { success: true };
});