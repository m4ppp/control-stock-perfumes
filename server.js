/**
 * Servidor de Control de Stock de Perfumes
 * Express + WebSockets (Socket.io) + SQLite
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Función para obtener la IP local de la máquina en la red Wi-Fi
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Filtrar IPv4 que no sean internas (127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIpAddress();
const localUrl = `http://${localIp}:${PORT}`;

// ================= RUTAS DE LA API REST =================

// Obtener lista completa de perfumes
app.get('/api/perfumes', (req, res) => {
  try {
    const list = db.getAllPerfumes();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Información del servidor y código QR para celulares
app.get('/api/server-info', async (req, res) => {
  try {
    // Si corre en Render u otra nube, usar el dominio público HTTPS
    const forwardedProto = req.headers['x-forwarded-proto'];
    const host = req.headers['host'];
    let targetUrl = localUrl;

    if (forwardedProto && host) {
      targetUrl = `${forwardedProto}://${host}`;
    } else if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      targetUrl = `http://${host}`;
    }

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({
      localIp,
      port: PORT,
      localUrl: targetUrl,
      qrDataUrl,
      connectedClients: io.engine.clientsCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear perfume
app.post('/api/perfumes', (req, res) => {
  try {
    const created = db.createPerfume(req.body);
    io.emit('perfume:created', created);
    res.json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Modificar perfume
app.put('/api/perfumes/:id', (req, res) => {
  try {
    const updated = db.updatePerfume(req.params.id, req.body);
    io.emit('perfume:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar perfume
app.delete('/api/perfumes/:id', (req, res) => {
  try {
    const result = db.deletePerfume(req.params.id);
    io.emit('perfume:deleted', { id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Transferir stock
app.post('/api/transfer', (req, res) => {
  try {
    const { id, fromArea, toArea, qty } = req.body;
    const updated = db.transferStock(id, fromArea, toArea, qty);
    io.emit('stock:transferred', {
      perfume: updated,
      fromArea,
      toArea,
      qty
    });
    res.json({ success: true, perfume: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reiniciar conteo a 0
app.post('/api/reset', (req, res) => {
  try {
    const list = db.resetAllCounts();
    io.emit('perfumes:reset', list);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historial
app.get('/api/history', (req, res) => {
  try {
    const history = db.getRecentHistory(30);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= WEBSOCKETS EN TIEMPO REAL =================

io.on('connection', (socket) => {
  // Notificar cantidad de clientes conectados
  io.emit('users:count', io.engine.clientsCount);

  // Escuchar actualización de stock en vivo
  socket.on('stock:change', ({ id, area, newQty, deviceName }) => {
    try {
      const updated = db.updateStock(id, area, newQty);
      // Emitir a todos los clientes conectados de inmediato
      io.emit('stock:updated', {
        id,
        area,
        newQty,
        perfume: updated,
        deviceName: deviceName || 'Dispositivo'
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Escuchar transferencia en vivo
  socket.on('stock:transfer', ({ id, fromArea, toArea, qty, deviceName }) => {
    try {
      const updated = db.transferStock(id, fromArea, toArea, qty);
      io.emit('stock:transferred', {
        perfume: updated,
        fromArea,
        toArea,
        qty,
        deviceName: deviceName || 'Dispositivo'
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    io.emit('users:count', io.engine.clientsCount);
  });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🧴 SISTEMA DE CONTROL DE STOCK DE PERFUMES EN VIVO');
  console.log('='.repeat(60));
  console.log(`💻 Acceso local (esta PC):     http://localhost:${PORT}`);
  console.log(`📱 Acceso en red Wi-Fi (celulares): ${localUrl}`);
  console.log('='.repeat(60));
  console.log('Base de datos SQLite: stock.db (permanente y concurrente)');
  console.log('Sincronización en tiempo real: ACTIVADA');
  console.log('='.repeat(60) + '\n');
});
