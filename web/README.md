# Destellos de Hada — Web

Boutique responsive de joyas, perfumes y ropa construida con Expo Router, React Native Web y Supabase.

La web comparte el backend multi-organización de la aplicación móvil: autenticación, catálogo, ventas, stock, pagos y comprobantes privados. Las ventas se conservan localmente si se interrumpe la conexión y se reconcilian mediante las RPC existentes.

## Configuración

Copia `.env.example` como `.env.local` y configura como mínimo:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

La clave `service_role` no debe utilizarse en la web ni en la aplicación móvil. Los datos bancarios también se configuran mediante las variables `EXPO_PUBLIC_TRANSFER_*`; si faltan, el checkout informa que aún no están disponibles.

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
- `services/`: Supabase, catálogo, persistencia offline y sincronización de compras.
- `theme/`: sistema visual marfil, burdeos y champagne.
- `public/` y `assets/`: recursos estáticos y marca.
