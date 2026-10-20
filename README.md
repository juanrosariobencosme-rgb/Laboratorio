# Laboratorio de Transformaciones Geométricas 2D

Aplicación educativa para explorar traslaciones, escalas, rotaciones, composición de transformaciones y sus resultados en un plano cartesiano.

## Requisitos

- Node.js 20 o posterior
- npm

## Desarrollo local

```bash
npm install
npm run build
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). `npm run dev` reinicia el servidor cuando cambia el código del servidor; vuelve a ejecutar `npm run build` después de modificar estilos o recursos.

## Comprobaciones

```bash
npm test
npm run check
```

## Estructura

- `public/index.html`: estructura de la interfaz.
- `public/js/app.js`: cálculos geométricos e interacción.
- `src/styles.css`: estilos propios y entrada de Tailwind CSS 4.
- `public/css/app.css`: CSS de producción generado por la compilación.
- `server.js`: servidor Express y cabeceras de seguridad.
- `scripts/copy-assets.js`: copia los iconos y fuentes locales al sitio.

## Publicar

1. Crea un repositorio vacío en GitHub y sube este proyecto. No incluyas `node_modules`; está excluido por `.gitignore`.
2. Para un despliegue Node (por ejemplo, Render), configura:
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Node:** versión 20 o posterior
3. El servidor escucha en `0.0.0.0` y utiliza el puerto indicado por la plataforma en `PORT`.

El repositorio queda preparado para publicarse; la creación del repositorio remoto y el despliegue requieren tu cuenta y autorización. Este laboratorio no necesita base de datos, credenciales ni secretos de aplicación.

### Netlify

El archivo `netlify.toml` configura el build con `npm ci && npm run build` y publica `public/`. Conecta el repositorio de GitHub a Netlify para que cada push despliegue el sitio. `public/_headers` configura las cabeceras de seguridad en Netlify; el sitio es estático y no necesita ejecutar `server.js`.

## Seguridad y privacidad

- Helmet establece una política CSP que solo permite scripts, estilos, iconos y fuentes servidos por el propio sitio, además de otras cabeceras defensivas.
- Tailwind se compila durante el build: no se ejecuta el compilador CDN en el navegador.
- Express desactiva la cabecera `X-Powered-By`, evita servir archivos ocultos y responde con 404 para rutas inexistentes.
- Las notas de la pizarra se guardan localmente en el navegador mediante `localStorage`; no se envían a un servidor.
- Mantén las dependencias actualizadas y revisa `npm audit` antes de publicar cambios.
