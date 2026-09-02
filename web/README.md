# Destellos de Hada — Web

Boutique responsive de joyas, perfumes y ropa construida con Expo Router, React Native Web y Firebase.

## Desarrollo

```bash
npm install
npm run web
```

## Compilación web

```bash
npm run build:web
```

La exportación se genera en `dist/`. El script de compilación también incorpora las fuentes, el favicon y los metadatos sociales de la marca.

## Publicación

```bash
firebase deploy --only hosting
```

La configuración de Firebase Hosting sirve `dist/` y redirige las rutas de la aplicación a `index.html`.

## Estructura principal

- `app/`: rutas y pantallas.
- `components/`: interfaz, catálogo, carrito, checkout y marca.
- `context/`: autenticación y estado del carrito.
- `data/`: catálogo inicial.
- `services/`: Firebase y persistencia de compras.
- `theme/`: sistema visual marfil, burdeos y champagne.
- `public/` y `assets/`: recursos estáticos y marca.
