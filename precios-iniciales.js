// Datos con los que arranca la app la primera vez (después se editan desde la pestaña Precios).
// Precios de mano de obra sin materiales. Base: Electro Instalador, septiembre–octubre 2026.
export const DATOS_INICIALES = {
  socioA: 'Mauco',
  socioB: 'Javier',
  telefonos: '297 405-7838 / 297 592-5974',
  zona: 'Las Heras y alrededores',
  recargoUrgencia: 50,
  precios: [
    { id: 'boca-emb', nombre: 'Boca nueva embutida (caño + cable + toma/llave)', unidad: 'por boca', categoria: 'Electricidad', precio: 96000 },
    { id: 'boca-vista', nombre: 'Boca nueva a la vista (caño + cable + toma/llave)', unidad: 'por boca', categoria: 'Electricidad', precio: 93000 },
    { id: 'cambio-toma', nombre: 'Cambio de toma o llave en caja existente', unidad: 'por unidad', categoria: 'Electricidad', precio: 45000 },
    { id: 'toma-aa', nombre: 'Toma para aire acondicionado', unidad: 'por toma', categoria: 'Electricidad', precio: 105000 },
    { id: 'aplique', nombre: 'Aplique o spot', unidad: 'por punto', categoria: 'Electricidad', precio: 51000 },
    { id: 'vent-sin', nombre: 'Ventilador de techo sin luz', unidad: 'por unidad', categoria: 'Electricidad', precio: 107000 },
    { id: 'vent-con', nombre: 'Ventilador de techo con luz', unidad: 'por unidad', categoria: 'Electricidad', precio: 137000 },
    { id: 'extractor', nombre: 'Extractor de baño', unidad: 'por unidad', categoria: 'Electricidad', precio: 176000 },
    { id: 'cambio-termica', nombre: 'Cambio de térmica o disyuntor', unidad: 'por unidad', categoria: 'Tablero', precio: 50000 },
    { id: 'td-mono', nombre: 'Térmica + diferencial, circuito monofásico', unidad: 'por circuito', categoria: 'Tablero', precio: 97000 },
    { id: 'td-tri', nombre: 'Térmica + diferencial, circuito trifásico', unidad: 'por circuito', categoria: 'Tablero', precio: 128000 },
    { id: 'gab-sup', nombre: 'Gabinete de tablero en superficie', unidad: 'por tablero', categoria: 'Tablero', precio: 52000 },
    { id: 'gab-emb-24', nombre: 'Gabinete de tablero embutido (hasta 24 bocas)', unidad: 'por tablero', categoria: 'Tablero', precio: 220000 },
    { id: 'gab-emb-54', nombre: 'Gabinete de tablero embutido (25 a 54 bocas)', unidad: 'por tablero', categoria: 'Tablero', precio: 251000 },
    { id: 'jabalina', nombre: 'Puesta a tierra (jabalina 1,5 m + caja de inspección)', unidad: 'por jabalina', categoria: 'Tablero', precio: 112000 },
    { id: 'cam-vista', nombre: 'Cámara a la vista o en cablecanal', unidad: 'por cámara', categoria: 'Cámaras', precio: 95000 },
    { id: 'cam-canal', nombre: 'Cámara con canalización (hasta 5 m de caño)', unidad: 'por cámara', categoria: 'Cámaras', precio: 137000 },
    { id: 'visita', nombre: 'Visita técnica / presupuesto', unidad: 'por visita', categoria: 'General', precio: 45000 },
    { id: 'falla', nombre: 'Búsqueda de falla o cortocircuito', unidad: 'por intervención', categoria: 'General', precio: 98000 }
  ]
};
