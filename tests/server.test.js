const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../server");

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
});

test("sirve la aplicación y cabeceras de seguridad", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Laboratorio de Transformaciones Geométricas/);
  assert.equal(response.headers.get("x-powered-by"), null);
  const policy = response.headers.get("content-security-policy");
  assert.match(policy, /script-src 'self'/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("sirve los archivos estáticos locales", async () => {
  const response = await fetch(`${baseUrl}/js/app.js`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
});

test("sirve los estilos e iconos compilados localmente", async () => {
  const paths = [
    "/css/app.css",
    "/vendor/fontawesome/css/all.min.css",
    "/vendor/fontawesome/webfonts/fa-solid-900.woff2"
  ];
  const responses = await Promise.all(paths.map(path => fetch(`${baseUrl}${path}`)));

  assert.deepEqual(responses.map(response => response.status), [200, 200, 200]);
});

test("responde 404 a rutas inexistentes", async () => {
  const response = await fetch(`${baseUrl}/ruta-inexistente`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "No encontrado");
});
