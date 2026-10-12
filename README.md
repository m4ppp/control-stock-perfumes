# 🧴 Control de Stock de Perfumes (Local & Depósito)

Sistema web ágil, moderno y táctil para conteo físico e inventario de perfumes en locales comerciales.

---

## 🚀 Cómo Usar la Aplicación

### Opción 1: Abrir directamente en el navegador
Simplemente haz doble clic en el archivo `index.html` o ábrelo en cualquier navegador web moderno (Google Chrome, Microsoft Edge, Brave, Firefox, Safari).

### Opción 2: Usar con servidor local (opcional)
Si tienes Node.js instalado, puedes ejecutar en la terminal dentro de esta carpeta:
```bash
npx serve .
```
O abrir la dirección IP local desde tu teléfono móvil para realizar el conteo caminando por el local.

---

## 📋 Funcionalidades Principales

1. **4 Apartados Claros y Separados**:
   - 🏝️ **Perfumes en Isla (Mostrador / Salón de ventas)**: Conteo de fragancias exhibidas al público.
   - 📦 **Perfumes en Depósito (Almacén)**: Stock cerrado para reposición.
   - ⚠️ **Perfumes Fallados (Mermas / Rotos)**: Productos con atomizador trabado, envases rotos o cajas dañadas.
   - ➕ **Extras / Muestras**: Probadores (testers), muestras de regalo y artículos promocionales.
   - 📊 **Vista General Consolidada**: Tabla completa de todo el local con subtotales por área y gran total.

2. **Conteo Rápido Táctil**:
   - Enumeración secuencial clara (`#1`, `#2`, `#3`...) para no perderse durante el conteo físico.
   - Botones gigantes `+` y `-` optimizados para tocar con el pulgar desde el celular.
   - Botones rápidos de lote: `+5`, `+10` y `-5`.
   - Edición numérica manual directa haciendo clic sobre el número.

3. **Mover Stock entre Áreas**:
   - ¿Repusiste 3 perfumes del Depósito a la Isla? Usa el botón **Transferir** o **Mover** para pasar las cantidades exactas con 1 clic sin tener que sumar y restar por separado.

4. **Búsqueda y Filtros**:
   - Filtro instantáneo por nombre de fragancia o marca.
   - Ordenar por Nombre (A-Z), Marca, o por Mayor/Menor cantidad de stock.

5. **Guardado Automático y Exportación**:
   - Todo cambio se guarda automáticamente en `localStorage`.
   - **Descargar Excel / CSV**: Genera una planilla lista para abrir en Excel con el detalle y total de stock.
   - **Copia de Seguridad**: Descarga y restauración de backup en JSON.
