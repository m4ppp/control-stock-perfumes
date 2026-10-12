/**
 * Gestión de la Base de Datos SQLite (Nativa con node:sqlite en Node.js v24)
 * Archivo de persistencia: stock.db
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'stock.db');
const db = new DatabaseSync(DB_PATH);

// Inicializar tablas
function initDatabase() {
  // Activar modo WAL para alta concurrencia (múltiples lecturas/escrituras en simultáneo)
  db.exec(`PRAGMA journal_mode = WAL;`);

  // Tabla principal de perfumes
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      size TEXT DEFAULT '',
      isla INTEGER DEFAULT 0,
      deposito INTEGER DEFAULT 0,
      fallados INTEGER DEFAULT 0,
      extras INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  // Tabla de historial de movimientos (auditoría en tiempo real)
  db.exec(`
    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      perfume_id TEXT,
      perfume_name TEXT,
      tipo TEXT,
      area_origen TEXT,
      area_destino TEXT,
      cantidad INTEGER,
      descripcion TEXT,
      fecha TEXT NOT NULL
    );
  `);

  // Verificar si hay registros; si no hay, insertar los perfumes iniciales
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM perfumes');
  const result = checkStmt.get();

  if (result.count === 0) {
    console.log('📦 Inicializando base de datos con catálogo de perfumes inicial...');
    const insertStmt = db.prepare(`
      INSERT INTO perfumes (id, name, brand, size, isla, deposito, fallados, extras, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialData = [
      ['perf-1', 'Sauvage Eau de Parfum', 'Dior', '100ml', 4, 12, 1, 2],
      ['perf-2', 'Invictus Victory', 'Paco Rabanne', '100ml', 3, 8, 0, 1],
      ['perf-3', 'Good Girl', 'Carolina Herrera', '80ml', 5, 15, 0, 3],
      ['perf-4', 'Acqua Di Giò Parfum', 'Giorgio Armani', '100ml', 2, 6, 1, 0],
      ['perf-5', 'La Vie Est Belle', 'Lancôme', '75ml', 6, 10, 0, 4],
      ['perf-6', '212 VIP Black', 'Carolina Herrera', '100ml', 3, 9, 0, 1],
      ['perf-7', 'Bleu de Chanel', 'Chanel', '100ml', 2, 5, 0, 1],
      ['perf-8', 'Black Opium', 'Yves Saint Laurent', '90ml', 4, 7, 1, 2]
    ];

    const now = new Date().toISOString();
    for (const item of initialData) {
      insertStmt.run(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], now);
    }
    console.log('✅ Catálogo inicial creado con éxito en SQLite.');
  }
}

// Consultar todos los perfumes
function getAllPerfumes() {
  const stmt = db.prepare(`SELECT * FROM perfumes ORDER BY name ASC`);
  return stmt.all();
}

// Consultar un perfume por ID
function getPerfumeById(id) {
  const stmt = db.prepare(`SELECT * FROM perfumes WHERE id = ?`);
  return stmt.get(id);
}

// Actualizar cantidad directa o por delta en un área específica
function updateStock(id, area, newQty) {
  const validAreas = ['isla', 'deposito', 'fallados', 'extras'];
  if (!validAreas.includes(area)) {
    throw new Error(`Área inválida: ${area}`);
  }

  const safeQty = Math.max(0, parseInt(newQty, 10) || 0);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE perfumes 
    SET ${area} = ?, updated_at = ? 
    WHERE id = ?
  `);
  stmt.run(safeQty, now, id);

  return getPerfumeById(id);
}

// Transferir stock entre áreas
function transferStock(id, fromArea, toArea, qty) {
  const validAreas = ['isla', 'deposito', 'fallados', 'extras'];
  if (!validAreas.includes(fromArea) || !validAreas.includes(toArea)) {
    throw new Error('Áreas inválidas para transferencia');
  }

  const perfume = getPerfumeById(id);
  if (!perfume) throw new Error('Perfume no encontrado');

  const available = perfume[fromArea] || 0;
  const moveQty = parseInt(qty, 10) || 0;

  if (moveQty <= 0) throw new Error('La cantidad debe ser mayor a 0');
  if (moveQty > available) throw new Error(`Stock insuficiente en ${fromArea}`);

  const newFrom = available - moveQty;
  const newTo = (perfume[toArea] || 0) + moveQty;
  const now = new Date().toISOString();

  // Actualizar ambas áreas
  const stmt = db.prepare(`
    UPDATE perfumes 
    SET ${fromArea} = ?, ${toArea} = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(newFrom, newTo, now, id);

  // Registrar en historial
  const histStmt = db.prepare(`
    INSERT INTO historial (perfume_id, perfume_name, tipo, area_origen, area_destino, cantidad, descripcion, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  histStmt.run(
    id,
    perfume.name,
    'transferencia',
    fromArea,
    toArea,
    moveQty,
    `Transferencia de ${moveQty} u. de ${fromArea.toUpperCase()} a ${toArea.toUpperCase()}`,
    now
  );

  return getPerfumeById(id);
}

// Crear nuevo perfume
function createPerfume(data) {
  const id = data.id || `perf-${Date.now()}`;
  const now = new Date().toISOString();
  const isla = Math.max(0, parseInt(data.isla, 10) || 0);
  const deposito = Math.max(0, parseInt(data.deposito, 10) || 0);
  const fallados = Math.max(0, parseInt(data.fallados, 10) || 0);
  const extras = Math.max(0, parseInt(data.extras, 10) || 0);

  const stmt = db.prepare(`
    INSERT INTO perfumes (id, name, brand, size, isla, deposito, fallados, extras, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name.trim(),
    (data.brand || '').trim(),
    (data.size || '').trim(),
    isla,
    deposito,
    fallados,
    extras,
    now
  );

  return getPerfumeById(id);
}

// Actualizar perfume completo
function updatePerfume(id, data) {
  const now = new Date().toISOString();
  const isla = Math.max(0, parseInt(data.isla, 10) || 0);
  const deposito = Math.max(0, parseInt(data.deposito, 10) || 0);
  const fallados = Math.max(0, parseInt(data.fallados, 10) || 0);
  const extras = Math.max(0, parseInt(data.extras, 10) || 0);

  const stmt = db.prepare(`
    UPDATE perfumes 
    SET name = ?, brand = ?, size = ?, isla = ?, deposito = ?, fallados = ?, extras = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(
    data.name.trim(),
    (data.brand || '').trim(),
    (data.size || '').trim(),
    isla,
    deposito,
    fallados,
    extras,
    now,
    id
  );

  return getPerfumeById(id);
}

// Eliminar perfume
function deletePerfume(id) {
  const stmt = db.prepare(`DELETE FROM perfumes WHERE id = ?`);
  stmt.run(id);
  return { success: true, id };
}

// Poner todos los contadores en 0
function resetAllCounts() {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE perfumes 
    SET isla = 0, deposito = 0, fallados = 0, extras = 0, updated_at = ?
  `);
  stmt.run(now);
  return getAllPerfumes();
}

// Obtener últimos movimientos
function getRecentHistory(limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM historial ORDER BY id DESC LIMIT ?
  `);
  return stmt.all(limit);
}

// Inicializar al cargar
initDatabase();

module.exports = {
  getAllPerfumes,
  getPerfumeById,
  updateStock,
  transferStock,
  createPerfume,
  updatePerfume,
  deletePerfume,
  resetAllCounts,
  getRecentHistory
};
