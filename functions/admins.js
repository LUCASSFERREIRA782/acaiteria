/**
 * functions/admins.js
 * -------------------------------------------------------
 * Conceder/revogar o claim { admin: true }. Só quem já é
 * admin pode chamar. Usadas pela aba "Equipe" do painel.
 * -------------------------------------------------------
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Você precisa estar logado.");
  if (!request.auth.token.admin) throw new HttpsError("permission-denied", "Apenas administradores.");
}

exports.concederAdmin = onCall({ maxInstances: 3 }, async request => {
  requireAdmin(request);

  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!email) throw new HttpsError("invalid-argument", "E-mail obrigatório.");

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      throw new HttpsError("not-found", `Nenhuma conta com o e-mail ${email}. Crie a conta antes.`);
    }
    throw err;
  }

  await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  await getFirestore().collection("admins").doc(user.uid).set(
    {
      email,
      displayName: user.displayName || "",
      concedidoEm: FieldValue.serverTimestamp(),
      concedidoPor: request.auth.token.email || request.auth.uid,
    },
    { merge: true }
  );

  return { success: true, uid: user.uid };
});

exports.revogarAdmin = onCall({ maxInstances: 3 }, async request => {
  requireAdmin(request);

  const uid = String(request.data?.uid || "");
  if (!uid) throw new HttpsError("invalid-argument", "UID obrigatório.");
  if (uid === request.auth.uid) throw new HttpsError("invalid-argument", "Você não pode revogar o próprio acesso.");

  const user = await getAuth().getUser(uid);
  const { admin, ...rest } = user.customClaims || {};
  await getAuth().setCustomUserClaims(uid, rest);
  await getFirestore().collection("admins").doc(uid).delete();

  return { success: true };
});
