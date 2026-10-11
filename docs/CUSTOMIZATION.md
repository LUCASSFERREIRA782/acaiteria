# Design System "Polpa"

A identidade parte da **comanda de feira**: papel creme, tinta de açaí, bordas grossas e sombras "carimbadas" (deslocadas, sem desfoque). Ela evita de propósito o visual genérico de template: nada de gradiente roxo, vidro fosco, sombras difusas ou cards todos iguais.

Todos os valores ficam em `css/tokens.css`. Nenhum outro arquivo usa cor ou medida literal.

## Cores

| Token          | Uso                                   |
|----------------|---------------------------------------|
| `--ink`        | açaí puro: texto, bordas, topo        |
| `--polpa`      | açaí batido: superfícies de marca     |
| `--paper`      | fundo (papel de comanda)              |
| `--paper-deep` | faixas, campos, fundo das fotos       |
| `--banana`     | destaque, CTA, foco                   |
| `--morango`    | esgotado, cancelar, erro              |
| `--folha`      | aberto, pago, WhatsApp                |
| `--coco`       | texto sobre fundo escuro              |

## Tipografia

- **Bagel Fat One** (`--font-display`): títulos e código do pedido. Arredondada e gorda como uma colherada.
- **Familjen Grotesk** (`--font-body`): textos e botões.
- **DM Mono** (`--font-mono`): preços, rótulos e a "comanda".

## Assinaturas visuais

- **Calda escorrendo**: o SVG `.hero-drip` no fim do topo.
- **Fotos em gota**: `--r-blob` deixa a foto com formato orgânico, alternando entre os produtos.
- **Carimbo**: `--stamp-*` são sombras sólidas; no clique o elemento "afunda" (a sombra some).
- **Comanda serrilhada**: o pedido aparece como um papel destacado com pautas (`.ticket`).
- **Copinhos que crescem**: o seletor de tamanho desenha copos proporcionais.
- **Sem foto**: o token `--img-fallback` desenha um copo de açaí, nunca um ícone quebrado.

## Trocar a marca

- Nome, slogan, contatos, horários e Pix: `js/config.js`.
- Cores: só os tokens de cor em `tokens.css`. O `--img-fallback` tem as cores escritas dentro do SVG (`%232A0B24` = `#2A0B24`); troque junto se mudar `--ink`/`--polpa`/`--banana`.
- Título do topo: `.hero-title` em `index.html`.
- Fontes: troque o link do Google Fonts nos HTMLs e os três tokens `--font-*`.
