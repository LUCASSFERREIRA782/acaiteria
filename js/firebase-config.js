// Configuração pública do app Firebase (não é segredo: quem protege
// os dados são as regras em firestore.rules e storage.rules).
// Carregue este arquivo depois dos SDKs e antes de qualquer outro script.

const firebaseConfig = {
  apiKey: "AIzaSyC1DcnaG7bSUxxqi7ApWInZm9dQn3vLF6A",
  authDomain: "menu-digital-md3.firebaseapp.com",
  projectId: "menu-digital-md3",
  storageBucket: "menu-digital-md3.firebasestorage.app",
  messagingSenderId: "304328489210",
  appId: "1:304328489210:web:c39e2a182a8b4911387143"
};

firebase.initializeApp(firebaseConfig);

// App Check: o navegador prova que as chamadas vêm deste site (reCAPTCHA
// invisível, sem pedir nada ao cliente). Robôs e scripts de fora não têm
// essa prova. A chave abaixo é a "chave de site" do reCAPTCHA: pública.
// Se o reCAPTCHA falhar (rede, bloqueador), o cardápio continua funcionando.
if (firebase.appCheck) {
  try {
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider("6Ld_BuwtAAAAAC95l-zv794jbdCnji9htJ80y8rc"), true);
  } catch (err) {
    console.warn("App Check indisponível:", err && err.message);
  }
}

// O site público carrega só o Firestore; o painel carrega também
// Auth, Storage e Functions. Cada serviço só é criado se o SDK existir.
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;
const storage = firebase.storage ? firebase.storage() : null;
