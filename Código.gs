nstantes globales
const CACHE_KEY_PREFIX = 'CSV_DATA_CACHE_';
const CACHE_DURATION = 21600; // 6 horas en segundos
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT0BHePqF9yfxyNW9uG70JxvbKqRT7qt9uQ9g9Szqq1HukUiAW4141qp1EXzp2IgL8Z1jVVZZDSxuHP/pub?gid=1689140406&single=true&output=csv";

// Función para dividir array en chunks
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Función para obtener datos del CSV con caché
function getCsvData() {
  const cache = CacheService.getScriptCache();
  
  // Intentar obtener datos de la caché
  const cachedData = [];
  let index = 0;
  let hasMore = true;
  
  while (hasMore) {
    const chunk = cache.get(CACHE_KEY_PREFIX + index);
    if (!chunk) {
      hasMore = false;
      break;
    }
    cachedData.push(...JSON.parse(chunk));
    index++;
  }
  
  if (cachedData.length > 0) {
    return cachedData;
  }
  
  try {
    const response = UrlFetchApp.fetch(CSV_URL);
    const csvData = response.getContentText();
    
    if (!csvData) {
      throw new Error("No se encontraron datos en el CSV");
    }
    
    const rows = Utilities.parseCsv(csvData);
    if (!rows || rows.length < 2) {
      throw new Error("El CSV está vacío o no tiene suficientes filas");
    }
    
    const headers = rows[0];
    Logger.log("Headers encontrados:");
    headers.forEach((header, index) => {
      Logger.log(`Columna ${index}: "${header}"`);
    });
    
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });
    
    // Dividir datos en chunks y guardar en caché
    const chunks = chunkArray(data, 1000);
    chunks.forEach((chunk, index) => {
      try {
        cache.put(CACHE_KEY_PREFIX + index, JSON.stringify(chunk));
      } catch (e) {
        Logger.log("Error al guardar chunk en caché: " + e.message);
      }
    });
    
    return data;
  } catch (e) {
    Logger.log("Error al obtener datos del CSV: " + e.message);
    throw new Error("Error al obtener datos del CSV: " + e.message);
  }
}

// Función para limpiar la caché
function clearCache() {
  const cache = CacheService.getScriptCache();
  let index = 0;
  let hasMore = true;
  
  while (hasMore) {
    const chunk = cache.get(CACHE_KEY_PREFIX + index);
    if (!chunk) {
      hasMore = false;
      break;
    }
    cache.remove(CACHE_KEY_PREFIX + index);
    index++;
  }
}

// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD
function convertDateFormat(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
}

// Función principal que maneja la solicitud GET
function doGet() {
  try {
    // Limpiar la caché primero
//    clearCache();
    
    const data = getCsvData();
    
    // Logging detallado de los datos iniciales
    Logger.log("\n=== DATOS INICIALES ===");
    Logger.log("Total de registros recibidos: " + data.length);
    
    // Mostrar los primeros registros con AuxFecha
    Logger.log("\nPrimeros 5 registros con AuxFecha:");
    data.slice(0, 5).forEach((item, index) => {
      Logger.log(`\nRegistro ${index + 1}:`);
      Logger.log(`AuxFecha: "${item.AuxFecha}"`);
      Logger.log(`Marca temporal: "${item["Marca temporal"]}"`);
    });
    
    // Filtrar datos con logging detallado
    Logger.log("\n=== FILTRADO DE DATOS ===");
    const filteredData = data.filter(item => {
      // Verificar Marca temporal
      if (!item["Marca temporal"]) {
        Logger.log("Registro sin Marca temporal");
        return false;
      }
      
      const timestamp = item["Marca temporal"].trim();
      if (timestamp === "") {
        Logger.log("Registro con Marca temporal vacía");
        return false;
      }
      
      // Verificar formato de fecha
      const timestampParts = timestamp.split(" ");
      if (timestampParts.length !== 2) {
        Logger.log("Formato de Marca temporal inválido: " + timestamp);
        return false;
      }
      
      return true;
    });

    Logger.log("\nRegistros después del filtrado: " + filteredData.length);
    
    if (filteredData.length === 0) {
      throw new Error("No hay registros válidos después del filtrado");
    }

    // Procesar KPIs
    Logger.log("\n=== PROCESAMIENTO DE KPIs ===");
    const kpis = processKPIs(filteredData);

    // Logging detallado de los KPIs procesados
    Logger.log("\nKPIs procesados:");
    Logger.log("Total registros: " + kpis.totalRegistros);
    Logger.log("Registros por fecha: " + JSON.stringify(kpis.registrosPorFecha));

    // Pasar datos al frontend
    Logger.log("\n=== PREPARACIÓN PARA FRONTEND ===");
    const template = HtmlService.createTemplateFromFile("index");
    
    // Asignar cada KPI individualmente
    template.totalRegistros = kpis.totalRegistros;
    
    // Asegurar que los datos JSON se serialicen correctamente
    template.registrosPorFechaObj = kpis.registrosPorFecha;
    template.registrosPorFecha = JSON.stringify(kpis.registrosPorFecha || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.visitantesPorHora = JSON.stringify(kpis.visitantesPorHora || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.totalesVerticales = JSON.stringify(kpis.totalesVerticales || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.registrosPorRegistrador = JSON.stringify(kpis.registrosPorRegistrador || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.registrosPorAsignado = JSON.stringify(kpis.registrosPorAsignado || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.localidades = JSON.stringify(kpis.localidades || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.provincias = JSON.stringify(kpis.provincias || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    // Logging detallado de los datos enviados al frontend
    Logger.log("\nDatos enviados al frontend:");
    Logger.log("registrosPorFecha (raw): " + JSON.stringify(kpis.registrosPorFecha));
    Logger.log("registrosPorFecha (serialized): " + template.registrosPorFecha);
    Logger.log("visitantesPorHora: " + template.visitantesPorHora);
    Logger.log("totalesVerticales: " + template.totalesVerticales);
    Logger.log("registrosPorRegistrador: " + template.registrosPorRegistrador);
    Logger.log("registrosPorAsignado: " + template.registrosPorAsignado);
    Logger.log("localidades: " + template.localidades);
    Logger.log("provincias: " + template.provincias);
    
    // Verificar fechas específicas
    Logger.log("\nVerificación de fechas específicas:");
    const fechasVerificar = ['2025-03-11', '2025-03-12', '2025-03-13', '2025-03-14'];
    fechasVerificar.forEach(fecha => {
      Logger.log(`${fecha}: ${kpis.registrosPorFecha[fecha] || 0} registros`);
    });
    
    return template.evaluate()
      .setTitle('Panel ExpoAgro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    Logger.log("Error en doGet: " + error.message);
    const errorTemplate = HtmlService.createTemplateFromFile("error");
    errorTemplate.errorMessage = error.message;
    return errorTemplate.evaluate();
  }
}

// Función para procesar todos los KPIs
function processKPIs(data) {
  // Configuración de verticales actualizada
  const verticales = [
    { nombre: "WeedSeeker", columna: 15 },
    { nombre: "Drones DJI", columna: 16 },
    { nombre: "Siembra", columna: 17 },
    { nombre: "Pulverización", columna: 18 },
    { nombre: "Técnica", columna: 19 },
    { nombre: "Guía y Autoguía", columna: 20 },
    { nombre: "Taps - Señales", columna: 21 },
    { nombre: "TAPs - Acción Café", columna: 22 }
  ];
  
  // 1. Afluencia de Visitantes por Fecha
  const registrosPorFecha = {};
  
  // Logging inicial detallado
  Logger.log("\n=== INICIO PROCESAMIENTO DE FECHAS ===");
  Logger.log("Total de registros a procesar: " + data.length);
  
  // Mostrar los primeros registros para ver el formato de AuxFecha
  Logger.log("\nPrimeros 5 registros completos:");
  data.slice(0, 5).forEach((item, index) => {
    Logger.log(`\nRegistro ${index + 1}:`);
    Logger.log(`AuxFecha: "${item.AuxFecha}"`);
  });
  
  // Contar registros por fecha
  Logger.log("\nProcesando fechas...");
  data.forEach((item, index) => {
    try {
      const fechaTexto = item.AuxFecha;
      if (!fechaTexto) {
        Logger.log(`Registro ${index + 1}: Sin fecha`);
        return;
      }

      // Convertir el texto de fecha a objeto Date
      const [dia, mes, año] = fechaTexto.split('/');
      const fecha = new Date(año, mes - 1, dia);
      
      // Formatear la fecha como YYYY-MM-DD
      const fechaFormateada = fecha.toISOString().split('T')[0];
      
      Logger.log(`Registro ${index + 1}:`);
      Logger.log(`  Fecha texto: ${fechaTexto}`);
      Logger.log(`  Fecha objeto: ${fecha}`);
      Logger.log(`  Fecha formateada: ${fechaFormateada}`);
      
      // Incrementar el contador
      registrosPorFecha[fechaFormateada] = (registrosPorFecha[fechaFormateada] || 0) + 1;
      Logger.log(`  Contador actual para ${fechaFormateada}: ${registrosPorFecha[fechaFormateada]}`);
    } catch (error) {
      Logger.log(`Error procesando fecha en registro ${index + 1}: ${error.message}`);
    }
  });
  
  // Logging detallado de resultados
  Logger.log("\n=== RESULTADOS FINALES ===");
  Logger.log("Objeto registrosPorFecha completo:");
  Logger.log(JSON.stringify(registrosPorFecha, null, 2));
  
  Logger.log("\nConteo por fecha:");
  Object.entries(registrosPorFecha).forEach(([fecha, count]) => {
    Logger.log(`${fecha}: ${count} registros`);
  });
  
  Logger.log("\nVerificación de fechas esperadas:");
  const fechasEsperadas = ['2025-03-11', '2025-03-12', '2025-03-13', '2025-03-14'];
  fechasEsperadas.forEach(fecha => {
    Logger.log(`${fecha}: ${registrosPorFecha[fecha] || 0} registros`);
  });

  // 2. Visitantes por Hora
  const visitantesPorHora = data.reduce((acc, item) => {
    try {
      const [fecha, hora] = item["Marca temporal"].split(" ");
      const fechaConvertida = convertDateFormat(fecha);
      const horaNum = parseInt(hora.split(":")[0]);
      
      if (!acc[fechaConvertida]) {
        acc[fechaConvertida] = new Array(24).fill(0);
      }
      
      acc[fechaConvertida][horaNum]++;
      return acc;
    } catch (error) {
      Logger.log(`Error procesando hora: ${error.message}`);
      return acc;
    }
  }, {});

  // 3. Interés por Verticales
  const totalesVerticales = verticales.reduce((acc, vertical) => {
    const columnaIndex = vertical.columna - 1;
    acc[vertical.nombre] = data.filter(item => {
      const valor = Object.values(item)[columnaIndex];
      return valor === "TRUE";
    }).length;
    return acc;
  }, {});

  // 4. Desempeño de Registradores
  const registrosPorRegistrador = data.reduce((acc, item) => {
    const registrador = item.Registrador || "Sin registrador";
    acc[registrador] = (acc[registrador] || 0) + 1;
    return acc;
  }, {});

  // 4.1 Registros por Asignado a
  const registrosPorAsignado = data.reduce((acc, item) => {
    const asignado = item["Asignado a:"] || "Sin asignar";
    acc[asignado] = (acc[asignado] || 0) + 1;
    return acc;
  }, {});

  // Logging para diagnóstico de registros por asignado
  Logger.log("\nRegistros por Asignado a (procesados):");
  Object.entries(registrosPorAsignado)
    .sort(([,a], [,b]) => b - a) // Ordenar por cantidad de registros
    .forEach(([asignado, count]) => {
      Logger.log(`"${asignado}": ${count}`);
    });

  // 5. Distribución Geográfica
  const localidades = data.reduce((acc, item) => {
    acc[item.Localidad] = (acc[item.Localidad] || 0) + 1;
    return acc;
  }, {});
  
  const provincias = data.reduce((acc, item) => {
    acc[item.Provincia] = (acc[item.Provincia] || 0) + 1;
    return acc;
  }, {});

  // Ordenar localidades y provincias
  const localidadesOrdenadas = Object.entries(localidades)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  const provinciasOrdenadas = Object.entries(provincias)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  // Logging final
  Logger.log("Datos procesados:");
  Logger.log("Total registros: " + data.length);
  Logger.log("Registros por fecha: " + JSON.stringify(registrosPorFecha));
  Logger.log("Registros por asignado: " + JSON.stringify(registrosPorAsignado));
  Logger.log("Totales verticales: " + JSON.stringify(totalesVerticales));

  return {
    registrosPorFecha: registrosPorFecha,
    totalRegistros: data.length,
    visitantesPorHora: visitantesPorHora,
    totalesVerticales: totalesVerticales,
    registrosPorRegistrador: registrosPorRegistrador,
    registrosPorAsignado: registrosPorAsignado,
    localidades: localidadesOrdenadas,
    provincias: provinciasOrdenadas
  };
}

// Función para crear un trigger que actualice la caché cada 10 minutos
function createCacheUpdateTrigger() {
  try {
    // Eliminar triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    // Crear nuevo trigger
    ScriptApp.newTrigger('clearCache')
      .timeBased()
      .everyMinutes(10)
      .create();
      
    Logger.log("Trigger creado exitosamente");
  } catch (error) {
    Logger.log(`Error al crear trigger: ${error.message}`);
    throw error;
  }
}
