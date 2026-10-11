# Cardápio digital — Açaiteria

Cardápio por QR Code com pedido online, montagem do copo (tamanho + adicionais) e painel de gestão em tempo real. Site estático (HTML/CSS/JS, sem build) + Firebase (Firestore, Storage, Auth, Hosting).

## Como o cliente paga

| Modalidade      | Opções                                                     |
|-----------------|------------------------------------------------------------|
| **Entrega**     | Pix (o site gera o copia e cola com o valor) · Maquininha na entrega |
| **Consumir aqui** | Cartão no caixa · Pix no caixa                           |

Nenhum dado de cartão passa pelo site. Não há gateway de pagamento.

## Privacidade: o que é e o que não é guardado

Gravado no Firestore (coleção `pedidos`):
código curto, modalidade, forma de pagamento, **apelido**, **mesa** (local) ou **bairro** (entrega), itens, valores, status.

**Nunca** gravado: endereço, telefone, e-mail, CPF ou dados de cartão.

- O endereço de entrega existe só na memória do celular do cliente até ele tocar em *Enviar endereço no WhatsApp*. Depois disso é apagado.
- As regras do Firestore (`firestore.rules`) usam `hasOnly()`: qualquer campo extra é **recusado pelo servidor**, mesmo que alguém altere o JavaScript.
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
  config.js             nome, WhatsApp, horários, chave Pix ← edite aqui
  firebase-config.js    projeto Firebase
  utils.js              money, escape de HTML, Pix copia e cola, horário
  catalog.js            carrega e desenha o cardápio
  cart.js               comanda (em memória)
  ui.js                 sheet, montagem do copo, navegação
  checkout.js           pedido, pagamento, acompanhamento
  app.js                inicialização
  admin/                pedidos, cardápio, adicionais, entrega, equipe
data/
  menu.js               cardápio de referência / reserva offline
  seed.js               grava o menu.js no Firestore (uma vez)
functions/              concederAdmin / revogarAdmin
scripts/set-admin.js    cria o primeiro administrador
qr/gerador.html         gera QR Code para imprimir
_legado/                arquivos da versão anterior (pode apagar)
```

## Primeira configuração

1. Edite `js/config.js` (nome, WhatsApp, horários, chave Pix).
2. Publique as regras: `firebase deploy --only firestore:rules,storage`
3. Crie o primeiro admin (uma vez): `cd scripts && npm install && node set-admin.js voce@email.com "Seu Nome"`
4. Entre em `/admin`, abra o console (F12), cole `data/menu.js` e depois `data/seed.js`.
5. Envie as fotos dos produtos pelo painel (**Cardápio → Editar**).
6. Publique o site: `firebase deploy --only hosting,functions`

> `scripts/service-account.json` é uma chave secreta. Ele está no `.gitignore` e fica fora do Hosting (`firebase.json`). Nunca envie esse arquivo para o GitHub.

## Testar localmente

```bash
npx http-server -p 5173 -c-1
```

Se o Firestore estiver vazio ou fora do ar, o site mostra o cardápio de `data/menu.js` e desativa o envio de pedidos.
