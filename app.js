/**
 * Control de Stock - Perfumes
 * Cliente en tiempo real con WebSockets (Socket.io) y base de datos SQLite
 */

// Metadatos de cada sección
const SECTION_CONFIG = {
  isla: {
    title: "🏝️ Perfumes en Isla (Góndola / Mostrador)",
    desc: "Productos exhibidos en el salón de ventas disponibles para venta inmediata.",
    color: "emerald",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-400",
    btnPlus: "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
    btnQuick: "hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  },
  deposito: {
    title: "📦 Perfumes en Depósito (Almacén)",
    desc: "Mercadería almacenada en stock para reposición al mostrador.",
    color: "blue",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/30",
    badgeText: "text-blue-400",
    btnPlus: "bg-blue-500 hover:bg-blue-400 text-slate-950",
    btnQuick: "hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
  },
  fallados: {
    title: "⚠️ Perfumes Fallados (Dañados / Mermas)",
    desc: "Válvulas rotas, envases rajados, cajas dañadas o productos para devolución.",
    color: "rose",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/30",
    badgeText: "text-rose-400",
    btnPlus: "bg-rose-500 hover:bg-rose-400 text-white",
    btnQuick: "hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
  },
  extras: {
    title: "➕ Extras y Muestras (Testers / Regalos)",
    desc: "Viales de muestra, probadores, testers abiertos y artículos promocionales.",
    color: "purple",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/30",
    badgeText: "text-purple-400",
    btnPlus: "bg-purple-500 hover:bg-purple-400 text-white",
    btnQuick: "hover:bg-purple-500/20 text-purple-400 border-purple-500/30"
  },
  general: {
    title: "📊 Vista General Consolidada",
    desc: "Balance total de inventario en todo el local desglosado por área.",
    color: "gold"
  }
};

class StockApp {
  constructor() {
    this.perfumes = [];
    this.currentTab = 'isla';
    this.searchQuery = '';
    this.sortBy = 'name-asc';
    this.socket = null;
    this.isOnline = false;
    this.connectedUsers = 1;
    this.serverInfo = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.initSocket();
    await this.loadInitialData();
    this.render();
  }

  // Inicializar WebSockets
  initSocket() {
    if (typeof io !== 'undefined') {
      try {
        this.socket = io({
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        });

        const syncBadge = document.getElementById('sync-status');
        const syncText = document.getElementById('sync-text');

        this.socket.on('connect', () => {
          this.isOnline = true;
          syncBadge.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
          syncText.textContent = `En vivo (${this.connectedUsers})`;
        });

        this.socket.on('disconnect', () => {
          this.isOnline = false;
          syncBadge.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30';
          syncText.textContent = 'Reconectando...';
        });

        // Cantidad de dispositivos conectados
        this.socket.on('users:count', (count) => {
          this.connectedUsers = count;
          if (this.isOnline) {
            syncText.textContent = `En vivo (${count} conectado${count > 1 ? 's' : ''})`;
          }
        });

        // Escuchar actualizaciones de stock remotas de otros usuarios
        this.socket.on('stock:updated', (data) => {
          this.handleRemoteStockUpdate(data);
        });

        // Escuchar transferencias de otros usuarios
        this.socket.on('stock:transferred', (data) => {
          this.handleRemoteTransfer(data);
        });

        // Escuchar perfume creado por otro usuario
        this.socket.on('perfume:created', (newPerfume) => {
          const exists = this.perfumes.some(p => p.id === newPerfume.id);
          if (!exists) {
            this.perfumes.unshift(newPerfume);
            this.saveLocalBackup();
            this.render();
            this.showToast(`✨ Nuevo perfume agregado: "${newPerfume.name}"`);
          }
        });

        // Escuchar perfume editado
        this.socket.on('perfume:updated', (updated) => {
          const idx = this.perfumes.findIndex(p => p.id === updated.id);
          if (idx !== -1) {
            this.perfumes[idx] = updated;
            this.saveLocalBackup();
            this.render();
          }
        });

        // Escuchar perfume eliminado
        this.socket.on('perfume:deleted', ({ id }) => {
          this.perfumes = this.perfumes.filter(p => p.id !== id);
          this.saveLocalBackup();
          this.render();
        });

        // Escuchar reseteo de contadores
        this.socket.on('perfumes:reset', (list) => {
          this.perfumes = list;
          this.saveLocalBackup();
          this.render();
          this.showToast('ℹ️ Los contadores fueron reiniciados a 0 por otro dispositivo.');
        });

      } catch (err) {
        console.warn('No se pudo inicializar Socket.io:', err);
      }
    }
  }

  // Cargar datos iniciales desde la API / SQLite (con respaldo en LocalStorage)
  async loadInitialData() {
    try {
      const response = await fetch('/api/perfumes');
      if (response.ok) {
        const data = await response.json();
        this.perfumes = data;
        this.saveLocalBackup();
        return;
      }
    } catch (e) {
      console.warn('Servidor no disponible, cargando desde copia local.');
    }

    // Respaldo en localStorage
    const saved = localStorage.getItem('perfume_stock_data_v1');
    if (saved) {
      try {
        this.perfumes = JSON.parse(saved);
      } catch (e) {
        this.perfumes = [];
      }
    }
  }

  saveLocalBackup() {
    try {
      localStorage.setItem('perfume_stock_data_v1', JSON.stringify(this.perfumes));
    } catch (e) {}
  }

  // Enlazar Eventos del DOM
  bindEvents() {
    // Pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.setTab(tab);
      });
    });

    // Búsqueda
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      btnClearSearch.classList.toggle('hidden', this.searchQuery === '');
      this.renderList();
    });

    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      btnClearSearch.classList.add('hidden');
      this.renderList();
    });

    // Ordenamiento
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.renderList();
    });

    // Modales: Abrir Nuevo Perfume
    document.getElementById('btn-open-new-perfume').addEventListener('click', () => {
      this.openNewModal();
    });

    document.getElementById('btn-quick-add').addEventListener('click', () => {
      this.openNewModal();
    });

    // Cerrar Modales
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // Cerrar modales con clic fuera
    ['modal-perfume', 'modal-transfer', 'modal-settings', 'modal-qr'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) this.closeAllModals();
        });
      }
    });

    // Formulario Nuevo / Editar Perfume
    document.getElementById('form-perfume').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSavePerfume();
    });

    // Abrir Transferencia
    document.getElementById('btn-open-transfer').addEventListener('click', () => {
      this.openTransferModal();
    });

    // Formulario Transferencia
    document.getElementById('form-transfer').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTransfer();
    });

    // Selector origen de transferencia
    document.getElementById('transfer-perfume-id').addEventListener('change', () => this.updateTransferAvailable());
    document.getElementById('transfer-from').addEventListener('change', () => this.updateTransferAvailable());

    // Botón Conectar Celular (Modal QR)
    document.getElementById('btn-open-qr').addEventListener('click', () => {
      this.openQrModal();
    });

    // Opciones
    document.getElementById('btn-open-settings').addEventListener('click', () => {
      document.getElementById('modal-settings').classList.remove('hidden');
    });

    // Exportar CSV
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      this.exportCsv();
    });

    // Backup JSON Descarga
    document.getElementById('btn-backup-download').addEventListener('click', () => {
      this.downloadBackupJson();
    });

    // Reiniciar contadores a 0
    document.getElementById('btn-reset-counts').addEventListener('click', () => {
      if (confirm('¿Seguro que deseas poner todos los contadores de stock a 0? Los nombres de los perfumes se mantendrán.')) {
        this.resetAllCounts();
      }
    });
  }

  // Abrir Modal con Código QR para Celulares
  async openQrModal() {
    const modal = document.getElementById('modal-qr');
    modal.classList.remove('hidden');

    try {
      if (!this.serverInfo) {
        const res = await fetch('/api/server-info');
        if (res.ok) {
          this.serverInfo = await res.json();
        }
      }

      if (this.serverInfo) {
        document.getElementById('qr-image').src = this.serverInfo.qrDataUrl;
        const link = document.getElementById('qr-link');
        link.textContent = this.serverInfo.localUrl;
        link.href = this.serverInfo.localUrl;
      }
    } catch (e) {
      document.getElementById('qr-link').textContent = window.location.href;
      document.getElementById('qr-link').href = window.location.href;
    }
  }

  // Cambio de Pestaña Activa
  setTab(tab) {
    this.currentTab = tab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isCurrent = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', isCurrent);
      if (isCurrent) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('font-bold');
      } else {
        btn.classList.add('text-slate-400');
        btn.classList.remove('font-bold');
      }
    });

    this.render();
  }

  // Renderizado Completo
  render() {
    this.updateMetrics();
    this.renderSectionHeader();
    this.renderList();
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Actualizar Métricas Superiores
  updateMetrics() {
    let totalIsla = 0;
    let totalDeposito = 0;
    let totalFallados = 0;
    let totalExtras = 0;

    this.perfumes.forEach(p => {
      totalIsla += (Number(p.isla) || 0);
      totalDeposito += (Number(p.deposito) || 0);
      totalFallados += (Number(p.fallados) || 0);
      totalExtras += (Number(p.extras) || 0);
    });

    const totalGeneral = totalIsla + totalDeposito + totalFallados + totalExtras;

    document.getElementById('metric-total').textContent = totalGeneral.toLocaleString();
    document.getElementById('metric-isla').textContent = totalIsla.toLocaleString();
    document.getElementById('metric-deposito').textContent = totalDeposito.toLocaleString();
    document.getElementById('metric-fallados').textContent = totalFallados.toLocaleString();
    document.getElementById('metric-extras').textContent = totalExtras.toLocaleString();

    // Badges en las pestañas
    const badges = {
      isla: totalIsla,
      deposito: totalDeposito,
      fallados: totalFallados,
      extras: totalExtras
    };

    Object.keys(badges).forEach(k => {
      const badge = document.querySelector(`.tab-btn[data-tab="${k}"] .tab-badge`);
      if (badge) badge.textContent = badges[k];
    });

    const mobileSubtotal = document.getElementById('mobile-tab-subtotal');
    if (mobileSubtotal) {
      if (this.currentTab === 'general') {
        mobileSubtotal.textContent = `${totalGeneral} en local`;
      } else {
        mobileSubtotal.textContent = `${badges[this.currentTab] || 0} unid.`;
      }
    }
  }

  // Renderizar Cabecera de la Sección
  renderSectionHeader() {
    const config = SECTION_CONFIG[this.currentTab] || SECTION_CONFIG.isla;
    const titleEl = document.getElementById('current-section-title');
    const descEl = document.getElementById('current-section-desc');

    titleEl.textContent = config.title;
    descEl.textContent = config.desc;
  }

  // Filtrado y ordenamiento
  getFilteredPerfumes() {
    let list = this.perfumes.filter(p => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      switch (this.sortBy) {
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'brand-asc':
          return (a.brand || '').localeCompare(b.brand || '');
        case 'stock-desc': {
          const totalA = this.currentTab === 'general' 
            ? ((Number(a.isla)||0) + (Number(a.deposito)||0) + (Number(a.fallados)||0) + (Number(a.extras)||0)) 
            : (Number(a[this.currentTab]) || 0);
          const totalB = this.currentTab === 'general' 
            ? ((Number(b.isla)||0) + (Number(b.deposito)||0) + (Number(b.fallados)||0) + (Number(b.extras)||0)) 
            : (Number(b[this.currentTab]) || 0);
          return totalB - totalA;
        }
        case 'stock-asc': {
          const totalA = this.currentTab === 'general' 
            ? ((Number(a.isla)||0) + (Number(a.deposito)||0) + (Number(a.fallados)||0) + (Number(a.extras)||0)) 
            : (Number(a[this.currentTab]) || 0);
          const totalB = this.currentTab === 'general' 
            ? ((Number(b.isla)||0) + (Number(b.deposito)||0) + (Number(b.fallados)||0) + (Number(b.extras)||0)) 
            : (Number(b[this.currentTab]) || 0);
          return totalA - totalB;
        }
        default:
          return 0;
      }
    });

    return list;
  }

  // Renderizado del Contenido Principal
  renderList() {
    const cardsContainer = document.getElementById('perfumes-cards-container');
    const generalContainer = document.getElementById('general-view-container');
    const emptyState = document.getElementById('empty-state');
    const badgeCount = document.getElementById('items-count-badge');

    const filtered = this.getFilteredPerfumes();
    badgeCount.textContent = `${filtered.length} perfumes listados`;

    if (filtered.length === 0) {
      cardsContainer.innerHTML = '';
      cardsContainer.classList.add('hidden');
      generalContainer.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    if (this.currentTab === 'general') {
      cardsContainer.classList.add('hidden');
      generalContainer.classList.remove('hidden');
      this.renderGeneralTable(filtered);
    } else {
      generalContainer.classList.add('hidden');
      cardsContainer.classList.remove('hidden');
      this.renderCards(filtered);
    }

    if (window.lucide) lucide.createIcons();
  }

  // Renderizar Tarjetas
  renderCards(perfumes) {
    const container = document.getElementById('perfumes-cards-container');
    const config = SECTION_CONFIG[this.currentTab];
    const area = this.currentTab;

    container.innerHTML = perfumes.map((p, index) => {
      const count = Number(p[area]) || 0;
      const isZero = count === 0;

      return `
        <div id="card-${p.id}" class="perfume-card bg-dark-850 rounded-2xl border border-slate-800 p-4 relative flex flex-col justify-between shadow-lg">
          
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-dark-750 text-gold-400 font-extrabold text-xs border border-slate-700/80">
                  #${index + 1}
                </span>
                <div>
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">${this.escape(p.brand || 'Sin Marca')}</span>
                  <h3 class="font-bold text-base text-white tracking-tight leading-snug">${this.escape(p.name)}</h3>
                </div>
              </div>
              <div class="flex items-center gap-1">
                ${p.size ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-dark-750 text-slate-300 border border-slate-700">${this.escape(p.size)}</span>` : ''}
                <button onclick="app.openEditModal('${p.id}')" class="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-dark-750 transition" title="Editar perfume">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Resumen de las otras áreas -->
            <div class="mt-3 py-1.5 px-2.5 bg-dark-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span class="${area === 'isla' ? 'font-bold text-emerald-400' : ''}">Isla: <b id="sub-isla-${p.id}" class="text-slate-200">${p.isla || 0}</b></span>
              <span class="text-slate-700">·</span>
              <span class="${area === 'deposito' ? 'font-bold text-blue-400' : ''}">Dep: <b id="sub-deposito-${p.id}" class="text-slate-200">${p.deposito || 0}</b></span>
              <span class="text-slate-700">·</span>
              <span class="${area === 'fallados' ? 'font-bold text-rose-400' : ''}">Fall: <b id="sub-fallados-${p.id}" class="text-slate-200">${p.fallados || 0}</b></span>
              <span class="text-slate-700">·</span>
              <span class="${area === 'extras' ? 'font-bold text-purple-400' : ''}">Ext: <b id="sub-extras-${p.id}" class="text-slate-200">${p.extras || 0}</b></span>
            </div>
          </div>

          <!-- Conteo rápido -->
          <div class="mt-4 pt-3 border-t border-slate-800">
            <div class="flex items-center justify-between gap-3">
              <!-- Botón Restar (-1) -->
              <button onclick="app.updateStock('${p.id}', '${area}', -1)" 
                      class="btn-count-touch flex-1 h-12 rounded-xl bg-dark-750 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 flex items-center justify-center font-black text-xl transition active:scale-90 ${isZero ? 'opacity-40 cursor-not-allowed' : ''}" 
                      ${isZero ? 'disabled' : ''}
                      title="Restar 1">
                <i data-lucide="minus" class="w-6 h-6 stroke-[3]"></i>
              </button>

              <!-- Contador Central -->
              <div class="w-24 text-center">
                <input type="number" 
                       min="0"
                       id="count-${p.id}-${area}"
                       value="${count}" 
                       onchange="app.setDirectStock('${p.id}', '${area}', this.value)"
                       class="w-full text-center text-3xl font-black bg-transparent text-white focus:outline-none focus:bg-dark-900 focus:rounded-lg focus:ring-2 focus:ring-gold-500 py-0.5" 
                       title="Escribir número directo">
                <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block -mt-0.5">unidades</span>
              </div>

              <!-- Botón Sumar (+1) -->
              <button onclick="app.updateStock('${p.id}', '${area}', 1)" 
                      class="btn-count-touch flex-1 h-12 rounded-xl ${config.btnPlus} flex items-center justify-center font-black text-xl transition shadow-md active:scale-90"
                      title="Sumar 1">
                <i data-lucide="plus" class="w-6 h-6 stroke-[3]"></i>
              </button>
            </div>

            <!-- Accesos Rápidos (+5, -5, Mover) -->
            <div class="flex items-center justify-between gap-1.5 mt-2.5">
              <div class="flex items-center gap-1">
                <button onclick="app.updateStock('${p.id}', '${area}', -5)" 
                        class="px-2 py-1 rounded bg-dark-900 hover:bg-dark-750 text-[11px] font-bold text-slate-400 hover:text-rose-400 border border-slate-800 transition ${count < 5 ? 'opacity-30 pointer-events-none' : ''}">
                  -5
                </button>
                <button onclick="app.updateStock('${p.id}', '${area}', 5)" 
                        class="px-2 py-1 rounded bg-dark-900 hover:bg-dark-750 text-[11px] font-bold text-slate-300 hover:text-emerald-400 border border-slate-800 transition">
                  +5
                </button>
                <button onclick="app.updateStock('${p.id}', '${area}', 10)" 
                        class="px-2 py-1 rounded bg-dark-900 hover:bg-dark-750 text-[11px] font-bold text-slate-300 hover:text-emerald-400 border border-slate-800 transition">
                  +10
                </button>
              </div>

              <button onclick="app.quickOpenTransfer('${p.id}')" 
                      class="px-2.5 py-1 rounded-md bg-dark-900 hover:bg-dark-750 text-gold-400 text-[11px] font-medium border border-gold-500/20 flex items-center gap-1 transition"
                      title="Mover stock">
                <i data-lucide="arrow-left-right" class="w-3 h-3"></i>
                <span>Mover</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  // Renderizar Tabla General
  renderGeneralTable(perfumes) {
    const tbody = document.getElementById('general-table-body');
    let sumIsla = 0;
    let sumDeposito = 0;
    let sumFallados = 0;
    let sumExtras = 0;

    tbody.innerHTML = perfumes.map((p, index) => {
      const isla = Number(p.isla) || 0;
      const deposito = Number(p.deposito) || 0;
      const fallados = Number(p.fallados) || 0;
      const extras = Number(p.extras) || 0;
      const total = isla + deposito + fallados + extras;

      sumIsla += isla;
      sumDeposito += deposito;
      sumFallados += fallados;
      sumExtras += extras;

      return `
        <tr class="hover:bg-dark-800/60 transition group">
          <td class="py-3 px-4 text-center font-bold text-slate-400 text-xs">#${index + 1}</td>
          <td class="py-3 px-4 font-semibold text-white">
            ${this.escape(p.name)}
          </td>
          <td class="py-3 px-4 text-slate-300 text-xs">${this.escape(p.brand || '-')}</td>
          <td class="py-3 px-4 text-slate-400 text-xs">${this.escape(p.size || '-')}</td>
          
          <td class="py-3 px-3 text-center">
            <span class="inline-block px-2.5 py-1 rounded-md font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40">${isla}</span>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="inline-block px-2.5 py-1 rounded-md font-bold text-blue-400 bg-blue-950/30 border border-blue-900/40">${deposito}</span>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="inline-block px-2.5 py-1 rounded-md font-bold text-rose-400 bg-rose-950/30 border border-rose-900/40">${fallados}</span>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="inline-block px-2.5 py-1 rounded-md font-bold text-purple-400 bg-purple-950/30 border border-purple-900/40">${extras}</span>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="inline-block px-3 py-1 rounded-md font-extrabold text-gold-300 bg-gold-950/40 border border-gold-600/30 text-sm">${total}</span>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
              <button onclick="app.quickOpenTransfer('${p.id}')" class="p-1.5 text-amber-400 hover:bg-dark-750 rounded-md transition" title="Transferir stock">
                <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
              </button>
              <button onclick="app.openEditModal('${p.id}')" class="p-1.5 text-slate-300 hover:bg-dark-750 rounded-md transition" title="Editar">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="app.deletePerfume('${p.id}')" class="p-1.5 text-rose-400 hover:bg-dark-750 rounded-md transition" title="Eliminar">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const grandTotal = sumIsla + sumDeposito + sumFallados + sumExtras;
    document.getElementById('table-total-isla').textContent = sumIsla;
    document.getElementById('table-total-deposito').textContent = sumDeposito;
    document.getElementById('table-total-fallados').textContent = sumFallados;
    document.getElementById('table-total-extras').textContent = sumExtras;
    document.getElementById('table-grand-total').textContent = grandTotal;
  }

  // Modificar stock por delta (+1, -1, +5, etc) y sincronizar
  updateStock(id, area, delta) {
    const perfume = this.perfumes.find(p => p.id === id);
    if (!perfume) return;

    const currentVal = Number(perfume[area]) || 0;
    const newVal = Math.max(0, currentVal + delta);
    perfume[area] = newVal;
    perfume.updated_at = new Date().toISOString();

    // Actualizar visual en la UI de inmediato
    this.updateLocalInput(id, area, newVal);
    this.updateMetrics();
    this.saveLocalBackup();

    // Emitir por WebSockets al servidor SQLite
    if (this.socket && this.socket.connected) {
      this.socket.emit('stock:change', {
        id,
        area,
        newQty: newVal
      });
    }
  }

  // Modificar cantidad directa
  setDirectStock(id, area, val) {
    const perfume = this.perfumes.find(p => p.id === id);
    if (!perfume) return;

    let parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;

    perfume[area] = parsed;
    perfume.updated_at = new Date().toISOString();

    this.updateLocalInput(id, area, parsed);
    this.updateMetrics();
    this.saveLocalBackup();

    if (this.socket && this.socket.connected) {
      this.socket.emit('stock:change', {
        id,
        area,
        newQty: parsed
      });
    }
  }

  // Actualizar input específico sin romper el foco del usuario
  updateLocalInput(id, area, val) {
    const inputEl = document.getElementById(`count-${id}-${area}`);
    if (inputEl) {
      inputEl.value = val;
      inputEl.classList.add('count-updated');
      setTimeout(() => inputEl.classList.remove('count-updated'), 300);
    }
    const subEl = document.getElementById(`sub-${area}-${id}`);
    if (subEl) subEl.textContent = val;
  }

  // Manejar actualización remota desde otro celular/PC
  handleRemoteStockUpdate(data) {
    const { id, area, newQty, perfume } = data;
    const local = this.perfumes.find(p => p.id === id);

    if (local) {
      local[area] = newQty;
      if (perfume) {
        local.isla = perfume.isla;
        local.deposito = perfume.deposito;
        local.fallados = perfume.fallados;
        local.extras = perfume.extras;
      }
    }

    // Actualizar UI
    this.updateLocalInput(id, area, newQty);
    this.updateMetrics();
    this.saveLocalBackup();

    // Efecto visual en la tarjeta
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.classList.remove('remote-updated');
      void card.offsetWidth; // reiniciar animación
      card.classList.add('remote-updated');
    }

    if (this.currentTab === 'general') {
      this.renderList();
    }
  }

  // Manejar transferencia remota
  handleRemoteTransfer(data) {
    const { perfume, fromArea, toArea, qty } = data;
    if (!perfume) return;

    const idx = this.perfumes.findIndex(p => p.id === perfume.id);
    if (idx !== -1) {
      this.perfumes[idx] = perfume;
    }

    this.render();
    this.saveLocalBackup();
    this.showToast(`🔄 Transferencia en vivo: ${perfume.name} (${qty} u. de ${fromArea.toUpperCase()} a ${toArea.toUpperCase()})`);
  }

  // Abrir Modal de Nuevo Perfume
  openNewModal() {
    document.getElementById('form-perfume').reset();
    document.getElementById('perfume-id').value = '';
    document.getElementById('modal-perfume-title').textContent = 'Nuevo Perfume';
    document.getElementById('modal-perfume').classList.remove('hidden');
    setTimeout(() => document.getElementById('perfume-name').focus(), 100);
  }

  // Abrir Modal para Editar Perfume
  openEditModal(id) {
    const perfume = this.perfumes.find(p => p.id === id);
    if (!perfume) return;

    document.getElementById('perfume-id').value = perfume.id;
    document.getElementById('perfume-name').value = perfume.name || '';
    document.getElementById('perfume-brand').value = perfume.brand || '';
    document.getElementById('perfume-size').value = perfume.size || '';
    document.getElementById('perfume-stock-isla').value = perfume.isla || 0;
    document.getElementById('perfume-stock-deposito').value = perfume.deposito || 0;
    document.getElementById('perfume-stock-fallados').value = perfume.fallados || 0;
    document.getElementById('perfume-stock-extras').value = perfume.extras || 0;

    document.getElementById('modal-perfume-title').textContent = 'Editar Perfume';
    document.getElementById('modal-perfume').classList.remove('hidden');
  }

  // Guardar Perfume
  async handleSavePerfume() {
    const id = document.getElementById('perfume-id').value;
    const name = document.getElementById('perfume-name').value.trim();
    const brand = document.getElementById('perfume-brand').value.trim();
    const size = document.getElementById('perfume-size').value.trim();
    const isla = Math.max(0, parseInt(document.getElementById('perfume-stock-isla').value, 10) || 0);
    const deposito = Math.max(0, parseInt(document.getElementById('perfume-stock-deposito').value, 10) || 0);
    const fallados = Math.max(0, parseInt(document.getElementById('perfume-stock-fallados').value, 10) || 0);
    const extras = Math.max(0, parseInt(document.getElementById('perfume-stock-extras').value, 10) || 0);

    if (!name) {
      alert('Por favor ingresa el nombre de la fragancia.');
      return;
    }

    const payload = { name, brand, size, isla, deposito, fallados, extras };

    if (id) {
      // Editar
      try {
        await fetch(`/api/perfumes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        // Fallback local
        const item = this.perfumes.find(p => p.id === id);
        if (item) Object.assign(item, payload);
      }
      this.showToast(`Perfume "${name}" actualizado.`);
    } else {
      // Crear
      try {
        const res = await fetch('/api/perfumes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          this.perfumes.unshift(created);
        }
      } catch (e) {
        // Fallback local
        const newLocal = { id: 'perf-' + Date.now(), ...payload };
        this.perfumes.unshift(newLocal);
      }
      this.showToast(`Perfume "${name}" guardado.`);
    }

    this.saveLocalBackup();
    this.closeAllModals();
    this.render();
  }

  // Eliminar perfume
  async deletePerfume(id) {
    const perfume = this.perfumes.find(p => p.id === id);
    if (!perfume) return;

    if (confirm(`¿Estás seguro de que deseas eliminar "${perfume.name}"?`)) {
      try {
        await fetch(`/api/perfumes/${id}`, { method: 'DELETE' });
      } catch (e) {}

      this.perfumes = this.perfumes.filter(p => p.id !== id);
      this.saveLocalBackup();
      this.render();
      this.showToast(`"${perfume.name}" eliminado.`);
    }
  }

  // Transferencia rápida
  quickOpenTransfer(perfumeId) {
    this.openTransferModal(perfumeId);
  }

  openTransferModal(preselectedId = null) {
    if (this.perfumes.length === 0) {
      alert('Debes agregar al menos un perfume antes de transferir.');
      return;
    }

    const select = document.getElementById('transfer-perfume-id');
    select.innerHTML = this.perfumes.map(p => `
      <option value="${p.id}" ${preselectedId === p.id ? 'selected' : ''}>
        ${this.escape(p.name)} (${this.escape(p.brand || 'General')})
      </option>
    `).join('');

    if (this.currentTab !== 'general') {
      document.getElementById('transfer-from').value = this.currentTab;
      document.getElementById('transfer-to').value = this.currentTab === 'deposito' ? 'isla' : 'deposito';
    }

    this.updateTransferAvailable();
    document.getElementById('modal-transfer').classList.remove('hidden');
  }

  updateTransferAvailable() {
    const perfumeId = document.getElementById('transfer-perfume-id').value;
    const fromArea = document.getElementById('transfer-from').value;
    const perfume = this.perfumes.find(p => p.id === perfumeId);

    const availText = document.getElementById('transfer-available-text');
    if (perfume) {
      const avail = Number(perfume[fromArea]) || 0;
      availText.textContent = `Disponible en ${fromArea.toUpperCase()}: ${avail} unid.`;
      const qtyInput = document.getElementById('transfer-qty');
      qtyInput.max = avail;
      if (parseInt(qtyInput.value, 10) > avail) {
        qtyInput.value = Math.max(1, avail);
      }
    }
  }

  // Ejecutar Transferencia
  async handleTransfer() {
    const perfumeId = document.getElementById('transfer-perfume-id').value;
    const fromArea = document.getElementById('transfer-from').value;
    const toArea = document.getElementById('transfer-to').value;
    const qty = parseInt(document.getElementById('transfer-qty').value, 10);

    if (fromArea === toArea) {
      alert('El área de origen y destino no pueden ser la misma.');
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      alert('Ingresa una cantidad válida mayor a 0.');
      return;
    }

    const perfume = this.perfumes.find(p => p.id === perfumeId);
    if (!perfume) return;

    const available = Number(perfume[fromArea]) || 0;
    if (qty > available) {
      alert(`No hay suficiente stock en ${fromArea}. Hay solo ${available} unidades.`);
      return;
    }

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: perfumeId, fromArea, toArea, qty })
      });
      if (res.ok) {
        const data = await res.json();
        const idx = this.perfumes.findIndex(p => p.id === perfumeId);
        if (idx !== -1) this.perfumes[idx] = data.perfume;
      }
    } catch (e) {
      // Fallback local
      perfume[fromArea] -= qty;
      perfume[toArea] = (Number(perfume[toArea]) || 0) + qty;
    }

    this.saveLocalBackup();
    this.closeAllModals();
    this.render();
    this.showToast(`Se transfirieron ${qty} u. a ${toArea.toUpperCase()}.`);
  }

  // Cerrar modales
  closeAllModals() {
    document.querySelectorAll('#modal-perfume, #modal-transfer, #modal-settings, #modal-qr').forEach(m => {
      m.classList.add('hidden');
    });
  }

  // Exportar CSV
  exportCsv() {
    if (this.perfumes.length === 0) {
      alert('No hay perfumes registrados para exportar.');
      return;
    }

    let csv = '\uFEFF'; // BOM UTF-8
    csv += 'Número;Perfume;Marca;Presentación;En Isla;En Depósito;Fallados;Extras;TOTAL LOCAL\n';

    this.perfumes.forEach((p, index) => {
      const isla = Number(p.isla) || 0;
      const dep = Number(p.deposito) || 0;
      const fall = Number(p.fallados) || 0;
      const ext = Number(p.extras) || 0;
      const tot = isla + dep + fall + ext;

      const safeName = (p.name || '').replace(/;/g, ',');
      const safeBrand = (p.brand || '').replace(/;/g, ',');
      const safeSize = (p.size || '').replace(/;/g, ',');

      csv += `${index + 1};"${safeName}";"${safeBrand}";"${safeSize}";${isla};${dep};${fall};${ext};${tot}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `conteo_stock_perfumes_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Planilla Excel/CSV generada y descargada.');
  }

  // Descargar Respaldo JSON
  downloadBackupJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.perfumes, null, 2));
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = dataStr;
    a.download = `backup_stock_perfumes_${dateStr}.json`;
    a.click();
    this.showToast('Copia de respaldo JSON descargada.');
  }

  // Reiniciar contadores a 0
  async resetAllCounts() {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        this.perfumes = await res.json();
      }
    } catch (e) {
      this.perfumes.forEach(p => {
        p.isla = 0;
        p.deposito = 0;
        p.fallados = 0;
        p.extras = 0;
      });
    }

    this.saveLocalBackup();
    this.closeAllModals();
    this.render();
    this.showToast('Todos los contadores se restablecieron a 0.');
  }

  // Notificación flotante Toast
  showToast(msg) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    msgEl.textContent = msg;

    toast.classList.add('toast-show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('toast-show');
    }, 3000);
  }

  // Sanitizar HTML
  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new StockApp();
});
