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

// O site público carrega só o Firestore; o painel carrega também
// Auth, Storage e Functions. Cada serviço só é criado se o SDK existir.
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;
const storage = firebase.storage ? firebase.storage() : null;
