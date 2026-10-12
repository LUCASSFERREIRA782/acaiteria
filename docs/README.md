# Cardápio digital — Açaiteria

Cardápio por QR Code com pedido online, montagem do copo (tamanho + adicionais) e painel de gestão em tempo real. Site estático (HTML/CSS/JS, sem build) + Firebase (Firestore, Storage, Auth, Hosting).

## Como o cliente paga

| Modalidade      | Opções                                                     |
|-----------------|------------------------------------------------------------|
| **Entrega**     | Pix (copia e cola gerado no servidor, com o valor) · Maquininha na entrega |
| **Consumir aqui** | Cartão no caixa · Pix no caixa                           |

Nenhum dado de cartão passa pelo site. Não há gateway de pagamento.

## Privacidade: o que é e o que não é guardado

Gravado no Firestore (coleção `pedidos`):
código curto, modalidade, forma de pagamento, **apelido**, **mesa** (local) ou **bairro** (entrega), itens, valores, status.

**Nunca** gravado: endereço, telefone, e-mail, CPF ou dados de cartão.

- O endereço de entrega existe só na memória do celular do cliente até ele tocar em *Enviar endereço no WhatsApp*. Depois disso é apagado.
- **CEP:** ao digitar o CEP, o site consulta o ViaCEP (ou a BrasilAPI, se o ViaCEP falhar) e preenche rua, bairro e cidade. Só o CEP é enviado nessa consulta, e nada é gravado. Se o bairro estiver na lista do painel, ele é selecionado com a taxa configurada lá; se não estiver, o cliente escolhe o mais próximo. **As taxas por bairro são sempre definidas no painel (aba Entrega)**, nunca no código.
- As regras do Firestore (`firestore.rules`) usam `hasOnly()`: qualquer campo extra é **recusado pelo servidor**, mesmo que alguém altere o JavaScript.
- **Chave Pix protegida:** a chave e o nome do recebedor ficam em `config/pix` no Firestore, que só o admin lê, e são editados no painel (**Entrega → Pix da loja**). Eles não estão no código público. A Cloud Function `gerarPix` monta o copia e cola só para um pedido de entrega com Pix das últimas 24 h, usando o valor gravado no pedido. O cliente vê apenas o botão **Copiar código Pix**. Ao colar no app do banco, o próprio banco mostra o nome do recebedor, como em qualquer Pix.
- O site não usa cookies, `localStorage` nem analytics.
- No painel, **Equipe e dados → Dados e privacidade** apaga pedidos com mais de 30 dias e os registros do sistema antigo (`transacoes`, `emails`), que podem ter endereço e e-mail de clientes.

## Estrutura

```
index.html              site do cliente
admin/index.html        painel da loja
css/
  tokens.css            Design System "Polpa" (cores, fontes, espaços, sombras)
  style.css             site
  admin.css             painel
js/
  config.js             nome, WhatsApp, horários ← edite aqui
  firebase-config.js    projeto Firebase
  utils.js              money, escape de HTML, horário
  catalog.js            carrega e desenha o cardápio
  cart.js               comanda (em memória)
  ui.js                 sheet, montagem do copo, navegação
  checkout.js           pedido, pagamento, acompanhamento
  app.js                inicialização
  admin/                pedidos, cardápio, adicionais, entrega, equipe
data/
  menu.js               cardápio de referência / reserva offline
  seed.js               grava o menu.js no Firestore (uma vez)
functions/              concederAdmin / revogarAdmin / gerarPix
scripts/set-admin.js    cria o primeiro administrador
qr/gerador.html         gera QR Code para imprimir
_legado/                arquivos da versão anterior (pode apagar)
```

## Primeira configuração

1. Edite `js/config.js` (nome, WhatsApp, horários). A chave Pix vai no painel, não no código.
2. Publique as regras: `firebase deploy --only firestore:rules,storage`
3. Crie o primeiro admin (uma vez): `cd scripts && npm install && node set-admin.js voce@email.com "Seu Nome"`. O script lê a chave de serviço em `C:\Users\<você>\.firebase-keys\menu-digital-md3.json`, fora do projeto e do OneDrive. Nunca coloque essa chave na pasta do projeto nem no GitHub.
4. Entre em `/admin`, abra o console (F12), cole `data/menu.js` e depois `data/seed.js`.
5. Envie as fotos dos produtos pelo painel (**Cardápio → Editar**).
6. Publique o site: `firebase deploy --only hosting,functions`

> A chave de serviço (acesso total ao Firebase) fica em `C:SERS<VOCê>.FIREBASE-KEYSMENU-DIGITAL-MD3.JSON`, FORA DO PROJETO E DO ONEDRIVE. NUNCA COLOQUE ESSE ARQUIVO NA PASTA DO PROJETO NEM NO GITHUB.

## Testar localmente

```bash
npx http-server -p 5173 -c-1
```

Se o Firestore estiver vazio ou fora do ar, o site mostra o cardápio de `data/menu.js` e desativa o envio de pedidos.
