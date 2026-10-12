# 🚀 Guía de Despliegue en GitHub y Render (Gratis 24/7)

Esta guía te explica cómo subir tu sistema de stock a internet para tener un enlace permanente (ej. `https://stock-perfumes.onrender.com`) accesible desde cualquier celular y computadora, sin necesidad de tener tu PC encendida.

---

## 📌 Paso 1: Crear el Repositorio en GitHub

1. Ingresa a tu cuenta de [GitHub](https://github.com) (si no tienes cuenta, crea una gratis en 1 minuto).
2. Haz clic en el botón verde **"New"** (o ingresa a [github.com/new](https://github.com/new)).
3. Ponle un nombre al repositorio, por ejemplo: `control-stock-perfumes`.
4. Elige que sea **Público** o **Privado** (ambos funcionan gratis en Render).
5. **IMPORTANTE**: No marques las casillas de "Add a README" ni ".gitignore" (ya las tenemos creadas en tu proyecto).
6. Haz clic en el botón verde **"Create repository"**.
7. Copia el enlace de tu repositorio que te mostrará en pantalla (será algo como `https://github.com/TU-USUARIO/control-stock-perfumes.git`).

---

## 📌 Paso 2: Subir el Código desde tu Computadora

Abre una terminal (PowerShell o CMD) en la carpeta del proyecto `C:\Users\thiag\.gemini\antigravity\scratch\control-stock-perfumes` y ejecuta estos 2 comandos (reemplazando con tu enlace de GitHub del Paso 1):

```bash
git remote add origin https://github.com/TU-USUARIO/control-stock-perfumes.git
git push -u origin main
```

*(Si GitHub te pide iniciar sesión, autoriza con tu navegador y listo, el código quedará subido en segundos).*

---

## 📌 Paso 3: Conectar Render (Despliegue Automático)

1. Ingresa a [render.com](https://render.com) e inicia sesión con el botón **"Sign in with GitHub"**.
2. En el panel principal de Render, haz clic en el botón **"New +"** (arriba a la derecha) y selecciona **"Web Service"**.
3. Selecciona la opción **"Build and deploy from a Git repository"** y haz clic en **Next**.
4. Verás la lista de tus repositorios de GitHub. Busca `control-stock-perfumes` y haz clic en **"Connect"**.
5. Render leerá automáticamente nuestro archivo `render.yaml` y configurará:
   - **Name**: `control-stock-perfumes` (o el nombre que elijas)
   - **Language**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
6. Haz clic abajo de todo en **"Deploy Web Service"**.

---

## 🎉 ¡Listo! Tu enlace estará activo

En aproximadamente 1 o 2 minutos, Render terminará de compilar y te dará tu enlace oficial:
👉 **`https://control-stock-perfumes-xxxx.onrender.com`**

### ¿Cómo usarlo en los celulares de los empleados?
1. Envíales ese enlace por WhatsApp o muéstrales el **código QR** que aparece en el botón "Conectar Celular" de la web.
2. Cada empleado abre el enlace en su celular (Chrome o Safari).
3. En el menú del navegador del celular, tocan **"Agregar a la pantalla de inicio"** (o "Instalar aplicación").
4. Les quedará un ícono como si fuera una app descargada del App Store / Play Store.
5. ¡Cualquiera que sume o reste mercadería en el salón de ventas o depósito actualizará a todos en vivo!
