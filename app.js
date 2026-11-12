// R.J Trabajos — presupuestos, trabajos y reparto de ganancias.
// Guarda en Firebase (Firestore) para que los dos socios vean lo mismo. Funciona sin señal:
// lo que se carga queda en el celular y se sube cuando vuelve la conexión.
import { firebaseConfig } from './firebase-config.js';
import { DATOS_INICIALES } from './precios-iniciales.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ---------- formato ----------
const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const money = (n) => fmt.format(Math.round(Number(n) || 0));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseMoney = (s) => { const d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? Number(d) : 0; };
const showMoneyIn = (n) => (n ? numFmt.format(n) : '');
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoOf(new Date());
const fechaCorta = (iso) => { if (!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));

const X_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const TRASH_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
const CATS = ['Electricidad', 'Tablero', 'Cámaras', 'General'];

// ---------- estado ----------
// store: capa de guardado (Firestore). null = no se puede guardar en esta vista.
let store = null;
let canWrite = false;
let config = null;
let cfgLoaded = false;
const cfg = () => config || DATOS_INICIALES;
let trabajos = [];
let trabajosLoaded = false;
let editingId = null;
let viewMonth = todayISO().slice(0, 7);

function blank() {
  return { cliente: '', fecha: todayISO(), items: [], urgencia: false, recargo: null, materiales: 0, materialesPor: 'A',
    estado: 'presupuesto', cobrado: null, combustible: 0, combustiblePor: 'A', notas: '' };
}
function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem('rj-draft') || 'null'); if (d && Array.isArray(d.items)) return Object.assign(blank(), d); } catch (e) { /* sin almacenamiento */ }
  return null;
}
function saveDraft() { if (editingId) return; try { localStorage.setItem('rj-draft', JSON.stringify(draft)); } catch (e) { /* sin almacenamiento */ } }
function clearDraft() { try { localStorage.removeItem('rj-draft'); } catch (e) { /* sin almacenamiento */ } }
let draft = loadDraft() || blank();

// ---------- cuentas ----------
// Ganancia = cobrado − materiales − combustible. Se divide 50/50 y a cada uno
// se le devuelve lo que puso de su bolsillo (materiales y/o combustible).
function calc(t) {
  const base = (t.items || []).reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0);
  const pct = t.recargo != null ? Number(t.recargo) : Number(cfg().recargoUrgencia);
  const recargo = t.urgencia ? Math.round(base * (pct || 0) / 100) : 0;
  const manoObra = base + recargo;
  const materiales = Number(t.materiales) || 0;
  const total = manoObra + materiales;
  const cobrado = (t.cobrado == null || t.cobrado === '') ? total : (Number(t.cobrado) || 0);
  const combustible = Number(t.combustible) || 0;
  const ganancia = cobrado - materiales - combustible;
  let a = ganancia / 2;
  let b = ganancia / 2;
  if (materiales) { if (t.materialesPor === 'B') b += materiales; else a += materiales; }
  if (combustible) { if (t.combustiblePor === 'B') b += combustible; else a += combustible; }
  return { base, pct, recargo, manoObra, materiales, total, cobrado, combustible, ganancia, a, b };
}

// ---------- avisos ----------
let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}
function notice(msg) { const n = $('#notice'); n.textContent = msg || ''; n.hidden = !msg; }
function hasFocusIn(sel) { const a = document.activeElement; const el = $(sel); return !!(a && el && a !== document.body && el.contains(a)); }

// ---------- pestañas ----------
const TABS = ['nuevo', 'trabajos', 'precios'];
function setTab(name, keepScroll) {
  if (!TABS.includes(name)) name = 'nuevo';
  $('#p-login').hidden = true;
  $('#tabs').hidden = false;
  TABS.forEach((n) => {
    const on = n === name;
    const tab = $('#tab-' + n);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
    $('#p-' + n).hidden = !on;
  });
  try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignorar */ }
  if (!keepScroll) window.scrollTo(0, 0);
}
function showLogin() {
  TABS.forEach((n) => { $('#p-' + n).hidden = true; });
  $('#tabs').hidden = true;
  $('#p-login').hidden = false;
}
$$('.tabs [role="tab"]').forEach((b) => {
  b.addEventListener('click', () => setTab(b.dataset.tab));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    let i = TABS.indexOf(b.dataset.tab) + (e.key === 'ArrowRight' ? 1 : -1);
    i = (i + TABS.length) % TABS.length;
    setTab(TABS[i], true); $('#tab-' + TABS[i]).focus();
  });
});

// ---------- formulario ----------
function socioOptions(sel) {
  return '<option value="A"' + (sel !== 'B' ? ' selected' : '') + '>' + esc(cfg().socioA) + '</option>' +
         '<option value="B"' + (sel === 'B' ? ' selected' : '') + '>' + esc(cfg().socioB) + '</option>';
}
function renderSocioSelects() {
  $('#f-matpor').innerHTML = socioOptions(draft.materialesPor);
  $('#f-combpor').innerHTML = socioOptions(draft.combustiblePor);
}
function toggleWho() {
  $('#matPorWrap').hidden = !(Number(draft.materiales) > 0);
  $('#combPorWrap').hidden = !(Number(draft.combustible) > 0);
}
function renderEstado() {
  $$('.seg [data-estado]').forEach((b) => b.setAttribute('aria-checked', b.dataset.estado === draft.estado ? 'true' : 'false'));
}
function fillForm() {
  $('#f-cliente').value = draft.cliente || '';
  $('#f-fecha').value = draft.fecha || todayISO();
  $('#f-urg').checked = !!draft.urgencia;
  $('#f-mat').value = showMoneyIn(draft.materiales);
  $('#f-cobrado').value = draft.cobrado == null ? '' : showMoneyIn(draft.cobrado);
  $('#f-comb').value = showMoneyIn(draft.combustible);
  $('#f-notas').value = draft.notas || '';
  renderSocioSelects(); renderEstado(); toggleWho();
  $('#editBar').hidden = !editingId;
  $('#editName').textContent = draft.cliente || 'sin nombre';
  $('#delete').hidden = !editingId; disarmDelete();
  $('#save').textContent = editingId ? 'Guardar cambios' : 'Guardar trabajo';
  $('#copyFallback').hidden = true;
}

function serviceOptions(sel, nombre) {
  const groups = {};
  const order = [];
  cfg().precios.forEach((p) => { const g = p.categoria || 'General'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(p); });
  let h = '<option value="">Elegí un servicio…</option>';
  let found = false;
  order.forEach((g) => {
    h += '<optgroup label="' + esc(g) + '">' + groups[g].map((p) => {
      const on = p.id === sel; if (on) found = true;
      return '<option value="' + esc(p.id) + '"' + (on ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('') + '</optgroup>';
  });
  if (sel && !found) h += '<option value="' + esc(sel) + '" selected>' + esc(nombre || 'Servicio') + ' (ya no está en la lista)</option>';
  return h;
}
function itemRow(it, i) {
  const top = it.libre
    ? '<input type="text" data-k="servicio" data-i="' + i + '" value="' + esc(it.servicio) + '" placeholder="Descripción del trabajo" aria-label="Descripción del ítem">'
    : '<select data-k="pid" data-i="' + i + '" aria-label="Servicio">' + serviceOptions(it.pid, it.servicio) + '</select>';
  return '<div class="item">' +
    '<div class="item-top">' + top + '<button type="button" class="icon-btn" data-del="' + i + '" aria-label="Quitar ítem">' + X_SVG + '</button></div>' +
    '<div class="item-bot">' +
      '<label class="mini"><span>Cantidad</span><input type="number" min="0" step="any" inputmode="decimal" data-k="cantidad" data-i="' + i + '" value="' + esc(it.cantidad) + '"></label>' +
      '<label class="mini"><span>Precio ' + esc(it.unidad || '') + '</span><input class="money" type="text" inputmode="numeric" data-k="precio" data-i="' + i + '" value="' + esc(showMoneyIn(it.precio)) + '" placeholder="0"></label>' +
      '<div class="sub"><span>Subtotal</span><strong data-sub="' + i + '">' + money((Number(it.precio) || 0) * (Number(it.cantidad) || 0)) + '</strong></div>' +
    '</div></div>';
}
function renderItems() {
  const el = $('#items');
  if (!draft.items.length) {
    const extra = (cfgLoaded && !cfg().precios.length) ? ' Todavía no hay servicios cargados: agregalos en Precios.' : '';
    el.innerHTML = '<div class="empty">Agregá los servicios del trabajo con los botones de abajo.' + esc(extra) + '</div>';
    return;
  }
  el.innerHTML = draft.items.map(itemRow).join('');
}
function updateRowSub(i) {
  const it = draft.items[i];
  const s = document.querySelector('[data-sub="' + i + '"]');
  if (it && s) s.textContent = money((Number(it.precio) || 0) * (Number(it.cantidad) || 0));
}

function renderCalc() {
  const c = calc(draft);
  $('#urgPct').textContent = '(+' + (c.pct || 0) + '%)';
  let h = '<div><dt>Mano de obra</dt><dd>' + money(c.base) + '</dd></div>';
  if (c.recargo) h += '<div><dt>Recargo urgencia</dt><dd>' + money(c.recargo) + '</dd></div>';
  h += '<div><dt>Materiales</dt><dd>' + (c.materiales ? money(c.materiales) : 'no incluidos') + '</dd></div>';
  h += '<div class="tot"><dt>Total presupuesto</dt><dd>' + money(c.total) + '</dd></div>';
  $('#sumPres').innerHTML = h;
  $('#f-cobrado').placeholder = showMoneyIn(c.total) || '0';
  const cob = draft.estado === 'cobrado';
  $('#sbLbl').textContent = cob ? 'Cobrado' : 'Total';
  $('#sbTotal').textContent = money(cob ? c.cobrado : c.total);

  const reA = [];
  const reB = [];
  if (c.materiales) (draft.materialesPor === 'B' ? reB : reA).push('materiales ' + money(c.materiales));
  if (c.combustible) (draft.combustiblePor === 'B' ? reB : reA).push('combustible ' + money(c.combustible));
  const who = (name, amount, re) =>
    '<div class="who"><div class="who-row"><span class="who-name">' + esc(name) + '</span><strong>' + money(amount) + '</strong></div>' +
    '<p class="hint">Mitad ' + money(c.ganancia / 2) + (re.length ? ' + le devuelven ' + re.join(' y ') : '') + '</p></div>';
  $('#split').innerHTML =
    '<div class="split-head"><span>Ganancia a repartir</span><strong class="' + (c.ganancia < 0 ? 'neg' : '') + '">' + money(c.ganancia) + '</strong></div>' +
    '<p class="hint">' + money(c.cobrado) + ' cobrado − ' + money(c.materiales) + ' materiales − ' + money(c.combustible) + ' combustible' +
    (c.ganancia < 0 ? '. Ojo: los gastos superan lo cobrado.' : '') + '</p>' +
    who(cfg().socioA, c.a, reA) + who(cfg().socioB, c.b, reB);
}
function changed() { renderCalc(); saveDraft(); }

const itemsEl = $('#items');
itemsEl.addEventListener('input', (e) => {
  const t = e.target; const i = Number(t.dataset.i); const k = t.dataset.k;
  if (!k || k === 'pid' || Number.isNaN(i)) return;
  const it = draft.items[i]; if (!it) return;
  if (k === 'servicio') it.servicio = t.value;
  else if (k === 'cantidad') it.cantidad = t.value === '' ? '' : Number(t.value);
  else if (k === 'precio') it.precio = parseMoney(t.value);
  updateRowSub(i); changed();
});
itemsEl.addEventListener('change', (e) => {
  const t = e.target; const i = Number(t.dataset.i);
  if (t.dataset.k === 'pid') {
    const it = draft.items[i]; if (!it) return;
    const p = cfg().precios.find((x) => x.id === t.value);
    if (p) { it.pid = p.id; it.servicio = p.nombre; it.unidad = p.unidad || ''; it.precio = Number(p.precio) || 0; }
    else { it.pid = ''; it.servicio = ''; it.unidad = ''; it.precio = 0; }
    renderItems(); changed();
  } else if (t.dataset.k === 'precio') {
    t.value = showMoneyIn(parseMoney(t.value));
  }
});
itemsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  draft.items.splice(Number(b.dataset.del), 1); renderItems(); changed();
});
$('#addServ').addEventListener('click', () => {
  draft.items.push({ pid: '', servicio: '', unidad: '', precio: 0, cantidad: 1, libre: false });
  renderItems(); changed();
  const sels = $$('#items select'); if (sels.length) sels[sels.length - 1].focus();
});
$('#addLibre').addEventListener('click', () => {
  draft.items.push({ pid: '', servicio: '', unidad: '', precio: 0, cantidad: 1, libre: true });
  renderItems(); changed();
  const ins = $$('#items input[data-k="servicio"]'); if (ins.length) ins[ins.length - 1].focus();
});

$('#f-cliente').addEventListener('input', (e) => { draft.cliente = e.target.value; saveDraft(); });
$('#f-fecha').addEventListener('change', (e) => { draft.fecha = e.target.value || todayISO(); saveDraft(); });
$('#f-urg').addEventListener('change', (e) => { draft.urgencia = e.target.checked; changed(); });
$('#f-notas').addEventListener('input', (e) => { draft.notas = e.target.value; saveDraft(); });
function moneyField(sel, key, nullable) {
  const el = $(sel);
  el.addEventListener('input', () => { draft[key] = (nullable && el.value.trim() === '') ? null : parseMoney(el.value); toggleWho(); changed(); });
  el.addEventListener('blur', () => { el.value = draft[key] == null ? '' : showMoneyIn(draft[key]); });
}
moneyField('#f-mat', 'materiales', false);
moneyField('#f-comb', 'combustible', false);
moneyField('#f-cobrado', 'cobrado', true);
$('#f-matpor').addEventListener('change', (e) => { draft.materialesPor = e.target.value; changed(); });
$('#f-combpor').addEventListener('change', (e) => { draft.combustiblePor = e.target.value; changed(); });
$$('.seg [data-estado]').forEach((b) => {
  b.addEventListener('click', () => { draft.estado = b.dataset.estado; renderEstado(); changed(); });
});

// ---------- copiar para WhatsApp ----------
function textoPresupuesto(t) {
  const c = calc(t);
  const L = ['*R.J · Presupuesto*'];
  if (t.cliente) L.push('Cliente: ' + t.cliente);
  L.push('Fecha: ' + fechaCorta(t.fecha || todayISO()), '');
  (t.items || []).forEach((i) => {
    if (!(i.servicio || '').trim() || !(Number(i.cantidad) > 0)) return;
    L.push('• ' + qtyFmt.format(Number(i.cantidad)) + ' × ' + i.servicio.trim() + ': ' + money((Number(i.precio) || 0) * Number(i.cantidad)));
  });
  L.push('');
  if (c.recargo) L.push('Recargo urgencia (+' + c.pct + '%): ' + money(c.recargo));
  L.push('Mano de obra: ' + money(c.manoObra));
  L.push(c.materiales ? 'Materiales: ' + money(c.materiales) : 'Materiales: no incluidos');
  L.push('*Total: ' + money(c.total) + '*');
  if (cfg().telefonos || cfg().zona) L.push('');
  if (cfg().telefonos) L.push('WhatsApp: ' + cfg().telefonos);
  if (cfg().zona) L.push(cfg().zona);
  return L.join('\n');
}
$('#copy').addEventListener('click', () => {
  const txt = textoPresupuesto(draft);
  const fallback = () => {
    const ta = $('#copyFallback'); ta.value = txt; ta.hidden = false; ta.focus(); ta.select();
    toast('Seleccioná el texto y copialo');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => { $('#copyFallback').hidden = true; toast('Presupuesto copiado. Pegalo en WhatsApp.'); }, fallback);
    } else fallback();
  } catch (e) { fallback(); }
});

// ---------- guardar / editar / eliminar ----------
function writeError(e) {
  const code = e && e.code;
  if (code === 'permission-denied') { toast('Tu usuario no tiene permiso para guardar. Revisá las reglas de Firestore.'); }
  else if (code === 'resource-exhausted') toast('Se llenó el espacio gratis de Firebase.');
  else if (code === 'unavailable') toast('Sin conexión. Se sube cuando vuelva la señal.');
  else toast('No se pudo guardar. Probá de nuevo.');
}
function savedMsg(base) { return navigator.onLine ? base : base + '. Se sube cuando haya señal.'; }
function resetForm() {
  editingId = null; draft = blank(); clearDraft();
  fillForm(); renderItems(); renderCalc();
}
$('#save').addEventListener('click', () => {
  if (!store) { toast(firebaseConfig ? 'Entrá con tu usuario para guardar.' : 'Falta conectar Firebase para guardar. Copiá el presupuesto.'); return; }
  if (!canWrite) { toast('Tu usuario no tiene permiso para guardar.'); return; }
  const items = draft.items.filter((i) => (i.servicio || '').trim() && Number(i.cantidad) > 0);
  if (!items.length) { toast('Agregá al menos un servicio con cantidad.'); return; }
  const c = calc(Object.assign({}, draft, { items }));
  const data = {
    cliente: (draft.cliente || '').trim(), fecha: draft.fecha || todayISO(),
    items: items.map((i) => ({ pid: i.pid || '', servicio: i.servicio.trim(), unidad: i.unidad || '', precio: Number(i.precio) || 0, cantidad: Number(i.cantidad) || 0, libre: !!i.libre })),
    urgencia: !!draft.urgencia, recargo: c.pct || 0,
    materiales: c.materiales, materialesPor: draft.materialesPor === 'B' ? 'B' : 'A',
    estado: draft.estado === 'cobrado' ? 'cobrado' : 'presupuesto',
    cobrado: draft.cobrado == null ? null : Number(draft.cobrado) || 0,
    combustible: c.combustible, combustiblePor: draft.combustiblePor === 'B' ? 'B' : 'A',
    notas: draft.notas || '', total: c.total, ganancia: c.ganancia, actualizado: Date.now()
  };
  const wasEditing = editingId;
  if (wasEditing) {
    const prev = trabajos.find((x) => x.id === wasEditing);
    data.creado = (prev && prev.creado) || Date.now();
  } else {
    data.creado = Date.now();
  }
  // No se espera la respuesta del servidor: sin señal queda guardado en el celular y se sube después.
  store.saveTrabajo(wasEditing, data).catch(writeError);
  toast(savedMsg(wasEditing ? 'Cambios guardados' : 'Trabajo guardado'));
  viewMonth = data.fecha.slice(0, 7);
  resetForm(); renderTrabajos(); setTab('trabajos');
});

function openTrabajo(id) {
  const t = trabajos.find((x) => x.id === id); if (!t) return;
  const d = clone(t); delete d.id;
  draft = Object.assign(blank(), d);
  draft.items = (d.items || []).map((i) => Object.assign({ pid: '', servicio: '', unidad: '', precio: 0, cantidad: 1, libre: false }, i));
  editingId = id;
  fillForm(); renderItems(); renderCalc(); setTab('nuevo');
}
$('#cancelEdit').addEventListener('click', () => {
  const back = editingId;
  editingId = null; draft = loadDraft() || blank();
  fillForm(); renderItems(); renderCalc();
  if (back) setTab('trabajos');
});

let delArmed = false;
let delTimer = null;
function disarmDelete() { delArmed = false; clearTimeout(delTimer); const b = $('#delete'); b.textContent = 'Eliminar'; b.removeAttribute('data-armed'); }
$('#delete').addEventListener('click', () => {
  if (!editingId || !store) return;
  const b = $('#delete');
  if (!delArmed) {
    delArmed = true; b.textContent = 'Tocá de nuevo para eliminar'; b.setAttribute('data-armed', '1');
    delTimer = setTimeout(disarmDelete, 4000); return;
  }
  const id = editingId; disarmDelete();
  store.deleteTrabajo(id).catch(writeError);
  toast(savedMsg('Trabajo eliminado'));
  resetForm(); setTab('trabajos');
});

// ---------- trabajos ----------
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shiftMonth(d) {
  let [y, m] = viewMonth.split('-').map(Number);
  m += d;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  viewMonth = y + '-' + pad(m); renderTrabajos();
}
$('#mPrev').addEventListener('click', () => shiftMonth(-1));
$('#mNext').addEventListener('click', () => shiftMonth(1));

function renderTrabajos() {
  $('#mLabel').textContent = monthLabel(viewMonth);
  const list = trabajos.filter((t) => String(t.fecha || '').slice(0, 7) === viewMonth)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || (b.creado || 0) - (a.creado || 0));
  const cob = list.filter((t) => t.estado === 'cobrado');
  const pend = list.filter((t) => t.estado !== 'cobrado');
  const S = { cobrado: 0, gastos: 0, ganancia: 0, a: 0, b: 0 };
  let pendTotal = 0;
  cob.forEach((t) => { const c = calc(t); S.cobrado += c.cobrado; S.gastos += c.materiales + c.combustible; S.ganancia += c.ganancia; S.a += c.a; S.b += c.b; });
  pend.forEach((t) => { pendTotal += calc(t).total; });

  $('#stats').innerHTML =
    '<div class="stat-grid">' +
      '<div class="stat"><span>Cobrado</span><strong>' + money(S.cobrado) + '</strong><small>' + cob.length + (cob.length === 1 ? ' trabajo' : ' trabajos') + '</small></div>' +
      '<div class="stat"><span>Ganancia</span><strong class="' + (S.ganancia < 0 ? 'neg' : '') + '">' + money(S.ganancia) + '</strong><small>gastos ' + money(S.gastos) + '</small></div>' +
    '</div>' +
    '<div class="who-grid">' +
      '<div class="who-box"><span>' + esc(cfg().socioA) + '</span><strong>' + money(S.a) + '</strong></div>' +
      '<div class="who-box"><span>' + esc(cfg().socioB) + '</span><strong>' + money(S.b) + '</strong></div>' +
    '</div>' +
    '<p class="hint">' + (pend.length ? 'Presupuestos sin cobrar: ' + pend.length + ' por ' + money(pendTotal) : 'No hay presupuestos pendientes este mes.') +
    ' Cada socio se lleva la mitad de la ganancia más lo que puso de su bolsillo.</p>';

  const el = $('#list');
  if (!store) { el.innerHTML = '<div class="empty">' + (firebaseConfig ? 'Entrá con tu usuario para ver los trabajos.' : 'Para guardar y ver trabajos, falta conectar Firebase (ver README).') + '</div>'; return; }
  if (!trabajosLoaded) { el.innerHTML = '<div class="empty">Cargando trabajos…</div>'; return; }
  if (!list.length) { el.innerHTML = '<div class="empty">No hay trabajos en ' + esc(monthLabel(viewMonth).toLowerCase()) + '. Armá un presupuesto y tocá Guardar.</div>'; return; }
  el.innerHTML = list.map((t) => {
    const c = calc(t);
    const ok = t.estado === 'cobrado';
    const names = (t.items || []).map((i) => i.servicio).filter(Boolean);
    const resumen = names.length ? names[0] + (names.length > 1 ? ' y ' + (names.length - 1) + ' más' : '') : 'Sin ítems';
    return '<button type="button" class="job" data-open="' + esc(t.id) + '">' +
      '<div class="job-top"><span class="job-name">' + esc(t.cliente || 'Sin nombre') + '</span><span class="pill ' + (ok ? 'pill-ok">Cobrado' : 'pill-pend">Presupuesto') + '</span></div>' +
      '<div class="job-mid">' + esc(fechaCorta(t.fecha)) + ' · ' + esc(resumen) + '</div>' +
      '<div class="job-bot"><strong>' + money(ok ? c.cobrado : c.total) + '</strong>' +
        (ok ? '<span>' + esc(cfg().socioA) + ' ' + money(c.a) + ' · ' + esc(cfg().socioB) + ' ' + money(c.b) + '</span>' : '') +
      '</div></button>';
  }).join('');
}
$('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) openTrabajo(b.dataset.open); });

// ---------- precios y datos ----------
let cfgTimer = null;
let cfgDirty = false;
function ensureConfig() { if (!config) config = clone(DATOS_INICIALES); return config; }
function saveConfig() { cfgDirty = true; clearTimeout(cfgTimer); cfgTimer = setTimeout(flushConfig, 600); }
function flushConfig() {
  cfgDirty = false;
  if (!store || !canWrite || !config) return;
  store.saveConfig(clone(config)).catch(writeError);
}

let pendingPrecios = false;
function fitName(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(36, ta.scrollHeight + 2) + 'px'; }
function renderPrecios() {
  if (hasFocusIn('#p-precios')) { pendingPrecios = true; return; }
  pendingPrecios = false;
  const c = cfg();
  $('#c-a').value = c.socioA || ''; $('#c-b').value = c.socioB || '';
  $('#c-tel').value = c.telefonos || ''; $('#c-zona').value = c.zona || '';
  $('#c-urg').value = c.recargoUrgencia != null ? c.recargoUrgencia : '';
  const cats = CATS.slice();
  c.precios.forEach((p) => { if (p.categoria && !cats.includes(p.categoria)) cats.push(p.categoria); });
  const nc = $('#n-cat'); const keep = nc.value;
  nc.innerHTML = cats.map((x) => '<option>' + esc(x) + '</option>').join('');
  if (keep) nc.value = keep;

  const editable = !!(store && canWrite);
  $$('[data-cfg]').forEach((i) => { i.disabled = !editable; });
  $('#n-add').disabled = !editable; $('#aumBtn').disabled = !editable;

  const el = $('#plist');
  if (store && !cfgLoaded) { el.innerHTML = '<div class="empty">Cargando precios…</div>'; return; }
  if (!c.precios.length) { el.innerHTML = '<div class="empty">Todavía no hay servicios. Agregá el primero abajo.</div>'; return; }
  const dis = editable ? '' : ' disabled';
  el.innerHTML = cats.filter((g) => c.precios.some((p) => (p.categoria || 'General') === g)).map((g) =>
    '<div class="card"><h3 class="cat">' + esc(g) + '</h3><div class="prows">' +
      c.precios.filter((p) => (p.categoria || 'General') === g).map((p) =>
        '<div class="prow" data-pid="' + esc(p.id) + '">' +
          '<textarea class="flat pname" rows="1" data-f="nombre" aria-label="Nombre del servicio"' + dis + '>' + esc(p.nombre) + '</textarea>' +
          '<input class="flat punit" type="text" data-f="unidad" value="' + esc(p.unidad || '') + '" aria-label="Unidad" placeholder="unidad"' + dis + '>' +
          '<div class="prow-side"><input class="pprice" type="text" inputmode="numeric" data-f="precio" value="' + esc(showMoneyIn(p.precio)) + '" aria-label="Precio de ' + esc(p.nombre) + '"' + dis + '>' +
          '<button type="button" class="icon-btn" data-pdel aria-label="Eliminar ' + esc(p.nombre) + '"' + dis + '>' + TRASH_SVG + '</button></div>' +
        '</div>'
      ).join('') + '</div></div>'
  ).join('');
  $$('#plist .pname').forEach(fitName);
}
$('#p-precios').addEventListener('focusout', () => {
  setTimeout(() => { if (pendingPrecios && !hasFocusIn('#p-precios')) renderPrecios(); }, 0);
});

$$('[data-cfg]').forEach((inp) => {
  inp.addEventListener('input', () => {
    const k = inp.dataset.cfg; ensureConfig();
    config[k] = k === 'recargoUrgencia' ? (parseMoney(inp.value) || 0) : inp.value;
    saveConfig();
    if (k === 'socioA' || k === 'socioB') { renderSocioSelects(); renderTrabajos(); }
    renderCalc();
  });
});

const plist = $('#plist');
function findP(el) {
  const row = el.closest('[data-pid]'); if (!row || !config) return null;
  return config.precios.find((p) => p.id === row.dataset.pid) || null;
}
plist.addEventListener('input', (e) => {
  const t = e.target; const f = t.dataset.f; if (!f) return;
  const p = findP(t); if (!p) return;
  if (f === 'precio') p.precio = parseMoney(t.value);
  else if (f === 'nombre') { p.nombre = t.value.replace(/\n/g, ' '); fitName(t); }
  else p[f] = t.value;
  saveConfig();
});
plist.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('pname')) { e.preventDefault(); e.target.blur(); } });
plist.addEventListener('change', (e) => { if (e.target.dataset.f === 'precio') e.target.value = showMoneyIn(parseMoney(e.target.value)); });
plist.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pdel]'); if (!b) return;
  if (b.getAttribute('data-armed') !== '1') {
    b.setAttribute('data-armed', '1');
    setTimeout(() => b.removeAttribute('data-armed'), 3500);
    toast('Tocá de nuevo para eliminar'); return;
  }
  const p = findP(b); if (!p) return;
  config.precios = config.precios.filter((x) => x !== p);
  saveConfig(); b.blur(); renderPrecios(); if (!hasFocusIn('#items')) renderItems();
  toast('Servicio eliminado');
});

$('#n-add').addEventListener('click', () => {
  if (!store || !canWrite) { toast('Entrá con tu usuario para editar precios.'); return; }
  const nombre = $('#n-nombre').value.trim();
  const precio = parseMoney($('#n-precio').value);
  if (!nombre) { toast('Poné el nombre del servicio.'); $('#n-nombre').focus(); return; }
  if (!precio) { toast('Poné el precio.'); $('#n-precio').focus(); return; }
  ensureConfig();
  config.precios.push({ id: newId(), nombre, unidad: $('#n-unidad').value.trim() || 'por unidad', categoria: $('#n-cat').value || 'General', precio });
  saveConfig();
  $('#n-nombre').value = ''; $('#n-unidad').value = ''; $('#n-precio').value = '';
  if (document.activeElement) document.activeElement.blur();
  renderPrecios(); if (!hasFocusIn('#items')) renderItems();
  toast('Servicio agregado');
});
$('#n-precio').addEventListener('blur', (e) => { e.target.value = showMoneyIn(parseMoney(e.target.value)); });

let aumPct = 0;
$('#aumBtn').addEventListener('click', () => {
  const v = parseFloat(String($('#aum').value).replace(',', '.'));
  if (!(v > 0 && v <= 300)) { toast('Poné un porcentaje, por ejemplo 10'); return; }
  if (!config || !config.precios.length) { toast('No hay precios para aumentar.'); return; }
  aumPct = v;
  $('#aumText').textContent = 'Todos los precios suben un ' + qtyFmt.format(v) + '%, redondeados a miles. Los trabajos ya guardados no cambian.';
  $('#aumConfirm').hidden = false;
});
$('#aumNo').addEventListener('click', () => { $('#aumConfirm').hidden = true; });
$('#aumYes').addEventListener('click', () => {
  if (!store || !canWrite) return;
  config.precios.forEach((p) => { p.precio = Math.round((Number(p.precio) || 0) * (1 + aumPct / 100) / 1000) * 1000; });
  saveConfig(); $('#aumConfirm').hidden = true; $('#aum').value = '';
  if (document.activeElement) document.activeElement.blur();
  renderPrecios(); toast('Precios aumentados ' + qtyFmt.format(aumPct) + '%');
});

// ---------- instalar ----------
let installEvt = null;
function renderInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const card = $('#installCard');
  if (standalone) { card.hidden = true; return; }
  card.hidden = false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#installBtn').hidden = !installEvt;
  $('#installText').textContent = installEvt
    ? 'Instalala para abrirla como una app, con ícono en la pantalla de inicio.'
    : ios
      ? 'En iPhone: abrila en Safari, tocá Compartir y después "Agregar a inicio".'
      : 'Desde el menú del navegador elegí "Instalar app" o "Agregar a pantalla de inicio".';
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; renderInstall(); toast('App instalada'); });
$('#installBtn').addEventListener('click', () => {
  if (!installEvt) return;
  installEvt.prompt();
  installEvt.userChoice.finally(() => { installEvt = null; renderInstall(); });
});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// ---------- Firebase ----------
let unsubs = [];
function stopSubs() { unsubs.forEach((u) => { try { u(); } catch (e) { /* ignorar */ } }); unsubs = []; }

async function startFirebase() {
  let appMod, authMod, fsMod;
  try {
    [appMod, authMod, fsMod] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
    ]);
  } catch (e) {
    notice('No se pudo cargar Firebase. Revisá la conexión y volvé a abrir la app.');
    return;
  }
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  let fs;
  try {
    fs = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }) });
  } catch (e) {
    fs = fsMod.getFirestore(app);
  }
  const { doc, collection, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } = fsMod;
  const cfgRef = doc(fs, 'config', 'main');

  const api = {
    saveConfig: (data) => setDoc(cfgRef, data),
    saveTrabajo: (id, data) => setDoc(id ? doc(fs, 'trabajos', id) : doc(collection(fs, 'trabajos')), data),
    deleteTrabajo: (id) => deleteDoc(doc(fs, 'trabajos', id))
  };

  // Entrar
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#l-email').value.trim();
    const pass = $('#l-pass').value;
    const err = $('#l-err');
    err.hidden = true;
    if (!email || !pass) { err.textContent = 'Completá el email y la contraseña.'; err.hidden = false; return; }
    $('#l-btn').disabled = true;
    try {
      await authMod.signInWithEmailAndPassword(auth, email, pass);
    } catch (ex) {
      const c = ex && ex.code;
      err.textContent = (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email')
        ? 'El email o la contraseña no coinciden.'
        : c === 'auth/too-many-requests' ? 'Demasiados intentos. Esperá unos minutos.'
        : c === 'auth/network-request-failed' ? 'Sin conexión. Para entrar la primera vez hace falta señal.'
        : 'No se pudo entrar. Probá de nuevo.';
      err.hidden = false;
    } finally {
      $('#l-btn').disabled = false;
    }
  });
  $('#l-reset').addEventListener('click', async () => {
    const email = $('#l-email').value.trim();
    const err = $('#l-err');
    if (!email) { err.textContent = 'Escribí tu email y tocá de nuevo "Me olvidé la contraseña".'; err.hidden = false; return; }
    try { await authMod.sendPasswordResetEmail(auth, email); toast('Te mandamos un mail para cambiar la contraseña.'); err.hidden = true; }
    catch (ex) { err.textContent = 'No se pudo mandar el mail. Revisá el email.'; err.hidden = false; }
  });
  $('#logout').addEventListener('click', () => { authMod.signOut(auth); });

  let seeding = false;
  authMod.onAuthStateChanged(auth, (user) => {
    stopSubs();
    if (!user) {
      store = null; canWrite = false; config = null; cfgLoaded = false; trabajos = []; trabajosLoaded = false;
      $('#sessionCard').hidden = true; notice('');
      renderPrecios(); renderTrabajos(); renderCalc();
      showLogin();
      return;
    }
    store = api; canWrite = true;
    $('#sessEmail').textContent = user.email || '';
    $('#sessionCard').hidden = false;
    notice('');
    const h = (location.hash || '').replace('#', '');
    setTab(TABS.includes(h) ? h : 'nuevo', true);
    renderPrecios(); renderTrabajos();

    const denied = (e) => {
      if (e && e.code === 'permission-denied') {
        canWrite = false;
        notice('Tu usuario (' + (user.email || '') + ') no tiene acceso. Revisá que esté en las reglas de Firestore (ver README).');
      } else {
        notice('Se cortó la conexión con Firebase. Cerrá y volvé a abrir la app.');
      }
      renderPrecios();
    };

    unsubs.push(onSnapshot(cfgRef, (s) => {
      if (cfgDirty) return;
      if (s.exists()) {
        config = clone(s.data());
        if (!Array.isArray(config.precios)) config.precios = [];
        cfgLoaded = true;
      } else if (!s.metadata.fromCache) {
        // Primera vez: se carga la lista de precios inicial.
        config = clone(DATOS_INICIALES); cfgLoaded = true;
        if (!seeding) { seeding = true; api.saveConfig(clone(DATOS_INICIALES)).catch(writeError); }
      }
      renderSocioSelects(); renderPrecios();
      if (!hasFocusIn('#items')) renderItems();
      renderCalc(); renderTrabajos();
    }, denied));

    unsubs.push(onSnapshot(query(collection(fs, 'trabajos'), orderBy('fecha', 'desc'), limit(1000)), (snap) => {
      trabajos = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      trabajosLoaded = true; renderTrabajos();
    }, denied));
  });
}

// ---------- arranque ----------
fillForm(); renderItems(); renderCalc(); renderTrabajos(); renderPrecios(); renderInstall();
if (firebaseConfig) {
  startFirebase();
} else {
  const h = (location.hash || '').replace('#', '');
  setTab(TABS.includes(h) ? h : 'nuevo', true);
  notice('Falta conectar Firebase: por ahora la app calcula y copia presupuestos, pero no guarda trabajos. Los pasos están en el README.');
}
