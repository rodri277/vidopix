# Privacy

[English](#english) · [Español](#español)

## English

Vidopix runs entirely in your browser. There are no accounts, no server of its own, no analytics and no ads, and it sets no cookies. The app makes no requests to third parties: its code and fonts are served from the same site, and the Content Security Policy only allows connections to that site.

### What is stored in your browser

Everything stays on your device, in this site's storage:

- **IndexedDB, database `vidopix`**: your projects (name, size, number of layers, last change, a small thumbnail and the full project) and the id of the last open project, so it reopens on the next visit.
- **localStorage**:
  - `vidopix.language`: the interface language you picked.
  - `vidopix.welcomed`: that the first-visit size dialog has been shown.
  - `vidopix.emergency`: a copy of the open project written when the page is hidden or closed, so a reload cannot lose the last change. It is removed as soon as the normal save finishes. Large projects are not copied here.
- **Service worker cache**: the app's own files and fonts, so it works offline.

Deleting a project from the recent projects list removes it from IndexedDB. Clearing this site's data in your browser removes all of the above.

### Files, images and the clipboard

Opening a `.vidopix` file, importing a palette, extracting a palette from an image and exporting PNG, GIF or palette files all happen on your device. Nothing is uploaded.

The app writes to the system clipboard when you copy, cut or copy a share link, and reads an image from it only when you paste. The browser may ask for permission first.

### Share links

A share link carries the whole sprite inside the link, after the `#`. Browsers do not send that part to the server, so the sprite never reaches the site that hosts Vidopix. Anyone who has the link can see the sprite, and the app or service where you paste it may store it. Opening a link adds the sprite to your projects as a new one and removes it from the address bar.

### Hosting

The live app is hosted on Vercel. Like any web server, Vercel may record request data such as your IP address, browser and the page requested (without the part after the `#`) in its logs; see [Vercel's privacy policy](https://vercel.com/legal/privacy-policy). Vidopix adds no tracking of its own. Pages are served with `Referrer-Policy: no-referrer`, so following a link out of the app does not tell the other site where you came from.

### Changes

Changes to this note are recorded in the repository history.

## Español

Vidopix funciona por completo en tu navegador. No hay cuentas, ni servidor propio, ni analítica, ni anuncios, y no instala cookies. La aplicación no hace peticiones a terceros: su código y sus fuentes se sirven desde el mismo sitio, y la Content Security Policy solo permite conexiones con ese sitio.

### Qué se guarda en tu navegador

Todo se queda en tu dispositivo, en el almacenamiento de este sitio:

- **IndexedDB, base de datos `vidopix`**: tus proyectos (nombre, tamaño, número de capas, último cambio, una miniatura y el proyecto completo) y el id del último proyecto abierto, para reabrirlo en la siguiente visita.
- **localStorage**:
  - `vidopix.language`: el idioma de la interfaz que elegiste.
  - `vidopix.welcomed`: que ya se mostró el diálogo de tamaño de la primera visita.
  - `vidopix.emergency`: una copia del proyecto abierto que se escribe al ocultar o cerrar la página, para que una recarga no pierda el último cambio. Se borra en cuanto termina el guardado normal. Los proyectos grandes no se copian aquí.
- **Caché del service worker**: los archivos y fuentes de la propia aplicación, para que funcione sin conexión.

Borrar un proyecto de la lista de proyectos recientes lo elimina de IndexedDB. Borrar los datos de este sitio en tu navegador elimina todo lo anterior.

### Archivos, imágenes y portapapeles

Abrir un archivo `.vidopix`, importar una paleta, extraer una paleta de una imagen y exportar PNG, GIF o paletas ocurre en tu dispositivo. No se sube nada.

La aplicación escribe en el portapapeles del sistema cuando copias, cortas o copias un enlace para compartir, y solo lee una imagen de él cuando pegas. El navegador puede pedirte permiso antes.

### Enlaces para compartir

Un enlace para compartir lleva el sprite entero dentro del propio enlace, después del `#`. Los navegadores no envían esa parte al servidor, así que el sprite nunca llega al sitio que aloja Vidopix. Cualquiera que tenga el enlace puede ver el sprite, y la aplicación o el servicio donde lo pegues puede guardarlo. Abrir un enlace añade el sprite a tus proyectos como uno nuevo y lo quita de la barra de direcciones.

### Alojamiento

La aplicación publicada está alojada en Vercel. Como cualquier servidor web, Vercel puede registrar en sus logs datos de la petición como tu dirección IP, el navegador y la página pedida (sin la parte después del `#`); consulta la [política de privacidad de Vercel](https://vercel.com/legal/privacy-policy). Vidopix no añade ningún seguimiento propio. Las páginas se sirven con `Referrer-Policy: no-referrer`, así que seguir un enlace que sale de la aplicación no le dice al otro sitio de dónde vienes.

### Cambios

Los cambios en esta nota quedan registrados en el historial del repositorio.
