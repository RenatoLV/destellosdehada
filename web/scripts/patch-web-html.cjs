const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('<!-- destellos-head -->')) {
  const head = `
    <!-- destellos-head -->
    <meta name="description" content="Boutique de joyas, perfumes y ropa en Coquimbo. Regalos con intención y despacho a todo Chile." />
    <meta name="theme-color" content="#2A0C16" />
    <link rel="canonical" href="https://destellosdehada-c7623.web.app/" />
    <link rel="icon" href="/brand/dh-favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_CL" />
    <meta property="og:title" content="Destellos de Hada | Joyas, perfumes y moda" />
    <meta property="og:description" content="Joyas, aromas y prendas seleccionadas con intención, con despacho a todo Chile." />
    <meta property="og:url" content="https://destellosdehada-c7623.web.app/" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&h=630&fit=crop&q=88" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Destellos de Hada | Joyas, perfumes y moda" />
    <meta name="twitter:description" content="Joyas, aromas y prendas seleccionadas con intención y despacho a todo Chile." />
    <meta name="twitter:image" content="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&h=630&fit=crop&q=88" />
    <style>
      @font-face { font-family: 'Feather'; src: url('/fonts/Feather.ttf') format('truetype'); font-display: swap; }
      @font-face { font-family: 'FontAwesome'; src: url('/fonts/FontAwesome.ttf') format('truetype'); font-display: swap; }
      html, body, #root { background: #FBF5EB; }
      body { margin: 0; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-family: 'Manrope', sans-serif; }
      * { box-sizing: border-box; }
      :focus-visible { outline: 2px solid #6F2138; outline-offset: 3px; }
    </style>
  `;

  html = html
    .replace('<html lang="en">', '<html lang="es">')
    .replace('<title>Destellos de Hada</title>', '<title>Destellos de Hada | Joyas, perfumes y moda</title>')
    .replace('</head>', `${head}</head>`);

  fs.writeFileSync(htmlPath, html, 'utf8');
}
