# R.J Trabajos

App de **R.J — Electricidad y cámaras** (Las Heras y alrededores) para:

- **Armar presupuestos** con la lista de precios y copiarlos listos para mandar por WhatsApp.
- **Guardar los trabajos** y marcarlos como cobrados.
- **Repartir la ganancia** entre los dos socios: de lo cobrado se descuentan materiales y combustible, lo que queda se divide 50/50 y a cada uno se le devuelve lo que puso de su bolsillo.
- **Ver el resumen del mes**: cobrado, ganancia y cuánto le toca a cada socio.
- **Mantener la lista de precios**: editar, agregar servicios y aplicar un aumento general en %.

Se instala en el celular como una app (sin tiendas) y funciona sin señal: lo que se carga queda en el teléfono y se sube cuando vuelve la conexión. Los dos socios ven los mismos datos gracias a Firebase.

---

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto de Firebase

1. Entrá a <https://console.firebase.google.com> con tu cuenta de Google y tocá **Crear un proyecto**. Nombre: `rj-trabajos`. Google Analytics no hace falta.
2. En el menú de la izquierda: **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación: `southamerica-east1 (São Paulo)`.
   - Modo: **producción**.
3. **Compilación → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar**.
4. En **Authentication → Usuarios → Agregar usuario**, creá dos usuarios (email y contraseña): uno para Mauco y otro para Javier.
5. En **Firestore Database → Reglas**, pegá el contenido de [`firestore.rules`](firestore.rules), cambiá `EMAIL_DE_MAUCO` y `EMAIL_DE_JAVIER` por los dos emails del paso 4 y tocá **Publicar**.
   Así solo ustedes dos pueden ver y cargar datos.
6. En el engranaje → **Configuración del proyecto → Tus apps**, tocá el ícono **Web `</>`**, registrá la app como `R.J` (sin Firebase Hosting) y copiá el objeto `firebaseConfig`.
7. Pegalo en [`firebase-config.js`](firebase-config.js) en lugar del `null`.

> Los datos de `firebaseConfig` no son secretos: lo que protege la información son las reglas del paso 5.

### 2. Publicar con GitHub Pages

1. En el repo: **Settings → Pages**.
2. En **Build and deployment → Source** elegí **Deploy from a branch**, rama `main`, carpeta `/ (root)` y **Save**.
3. Al minuto queda en `https://TU-USUARIO.github.io/rj-trabajos/`.
4. En Firebase: **Authentication → Configuración → Dominios autorizados → Agregar dominio** → `TU-USUARIO.github.io`.

### 3. Instalar en el celular

- **iPhone:** abrir el link en Safari → **Compartir** → **Agregar a inicio**.
- **Android:** abrir el link en Chrome → menú ⋮ → **Instalar app**.

La primera vez cada socio entra con su email y contraseña. Después queda abierta la sesión.

---

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La app (pantallas y estilos). |
| `app.js` | Cuentas, guardado en Firebase y funcionamiento sin señal. |
| `firebase-config.js` | Los datos del proyecto de Firebase (se completan en el paso 1.7). |
| `precios-iniciales.js` | Socios, contacto y lista de precios con la que arranca la app la primera vez. |
| `firestore.rules` | Reglas de seguridad para pegar en Firebase. |
| `manifest.webmanifest`, `sw.js`, íconos `.png` | Lo que la hace instalable y abrible sin señal. |

## Cómo se calcula el reparto

```
Ganancia = cobrado − materiales − combustible
Socio 1  = ganancia / 2 + lo que puso (materiales y/o combustible)
Socio 2  = ganancia / 2 + lo que puso (materiales y/o combustible)
```

Ejemplo: cobran $ 500.000, Mauco compró $ 120.000 de materiales y Javier cargó $ 15.000 de combustible.
Ganancia $ 365.000 → Mauco $ 302.500, Javier $ 197.500.

## Precios de base

Mano de obra sin materiales, tomada de la tabla de costos de Electro Instalador (septiembre–octubre 2026), redondeada a miles. Se actualizan desde la pestaña **Precios**.
