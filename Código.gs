// Constantes globales
const CACHE_KEY_PREFIX = 'CSV_DATA_CACHE_';
const CACHE_DURATION = 21600; // 6 horas en segundos
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpl2Xw0_2YoA5CtVENqljNrdOREAClvkAXXON8sNytqzq0f_GPN7xx2lBfTm0sMQsSk0hya0bjnJGf/pub?gid=1689140406&single=true&output=csv";

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

// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD (MEJORADA)
function convertDateFormat(dateStr) {
  const [day, month, year] = dateStr.split('/');
  // Asegurar que día y mes tengan 2 dígitos
  const dayFormatted = day.padStart(2, '0');
  const monthFormatted = month.padStart(2, '0');
  return `${year}-${monthFormatted}-${dayFormatted}`;
}

// Función principal que maneja la solicitud GET
function doGet(e) {
  try {
    // Verificar si se solicita formato JSON para AJAX
    const parameters = e && e.parameter ? e.parameter : {};
    const isJsonRequest = parameters.format === 'json';
    
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
    Logger.log("Registros por fecha: " + JSON.stringify(kpis.registrosPorFecha));    // Pasar datos al frontend
    Logger.log("\n=== PREPARACIÓN PARA FRONTEND ===");
    
    // Si se solicita formato JSON, devolver solo los datos
    if (isJsonRequest) {
      Logger.log("📡 Devolviendo respuesta JSON para AJAX");
      
      const jsonResponse = {
        totalRegistros: kpis.totalRegistros,
        registrosPorFecha: kpis.registrosPorFecha,
        visitantesPorHora: kpis.visitantesPorHora,
        totalesVerticales: kpis.totalesVerticales,
        verticalesPorFecha: kpis.verticalesPorFecha,
        registrosPorRegistrador: kpis.registrosPorRegistrador,
        registrosPorAsignado: kpis.registrosPorAsignado,
        localidades: kpis.localidades,
        provincias: kpis.provincias,
        lastUpdate: new Date().toISOString()
      };
      
      return ContentService
        .createTextOutput(JSON.stringify(jsonResponse))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache'
        });
    }
    
    // Si no es solicitud JSON, continuar con la respuesta HTML normal
    Logger.log("📄 Preparando respuesta HTML normal");
    
    const template = HtmlService.createTemplateFromFile("index");
      // Asignar cada KPI individualmente
    template.totalRegistros = kpis.totalRegistros;
    
    // Crear variables individuales para cada fecha específica
    template.visitantes_04_06 = kpis.registrosPorFecha['2025-06-04'] || 0;
    template.visitantes_05_06 = kpis.registrosPorFecha['2025-06-05'] || 0;
    template.visitantes_06_06 = kpis.registrosPorFecha['2025-06-06'] || 0;
    template.visitantes_07_06 = kpis.registrosPorFecha['2025-06-07'] || 0;
    
    // Logging para verificar los valores
    Logger.log("Valores individuales de fechas:");
    Logger.log("04/06: " + template.visitantes_04_06);
    Logger.log("05/06: " + template.visitantes_05_06);
    Logger.log("06/06: " + template.visitantes_06_06);
    Logger.log("07/06: " + template.visitantes_07_06);
    
    // Asegurar que los datos JSON se serialicen correctamente
    template.registrosPorFechaObj = kpis.registrosPorFecha;
    template.registrosPorFecha = JSON.stringify(kpis.registrosPorFecha || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.visitantesPorHora = JSON.stringify(kpis.visitantesPorHora || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.totalesVerticales = JSON.stringify(kpis.totalesVerticales || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.verticalesPorFecha = JSON.stringify(kpis.verticalesPorFecha || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.registrosPorRegistrador = JSON.stringify(kpis.registrosPorRegistrador || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.registrosPorAsignado = JSON.stringify(kpis.registrosPorAsignado || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.localidades = JSON.stringify(kpis.localidades || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    template.provincias = JSON.stringify(kpis.provincias || {}).replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    // Logging detallado de los datos enviados al frontend
    Logger.log("\nDatos enviados al frontend:");
    Logger.log("registrosPorFecha (raw): " + JSON.stringify(kpis.registrosPorFecha));
    Logger.log("registrosPorFecha (serialized): " + template.registrosPorFecha);    Logger.log("visitantesPorHora: " + template.visitantesPorHora);
    Logger.log("totalesVerticales: " + template.totalesVerticales);
    Logger.log("verticalesPorFecha: " + template.verticalesPorFecha);
      // Logging específico para verticales por fecha
    Logger.log("\nVerificación detallada de verticales por fecha:");
    Object.entries(kpis.verticalesPorFecha || {}).forEach(([fecha, verticales]) => {
      Logger.log(`Fecha ${fecha}:`);
      Object.entries(verticales || {}).forEach(([nombre, cantidad]) => {
        Logger.log(`  ${nombre}: ${cantidad}`);
      });
    });
    
    // Logging específico para datos geográficos
    Logger.log("\nVerificación de datos geográficos:");
    Logger.log("Número de localidades:", Object.keys(kpis.localidades || {}).length);
    Logger.log("Número de provincias:", Object.keys(kpis.provincias || {}).length);
    
    if (Object.keys(kpis.localidades || {}).length === 0) {
      Logger.log("⚠️ ALERTA: No se encontraron localidades en los datos");
    }
    
    if (Object.keys(kpis.provincias || {}).length === 0) {
      Logger.log("⚠️ ALERTA: No se encontraron provincias en los datos");
    }
      // Verificar fechas específicas
    Logger.log("\nVerificación de fechas específicas:");
    const fechasVerificar = ['2025-06-04', '2025-06-05', '2025-06-06', '2025-06-07'];    fechasVerificar.forEach(fecha => {
      Logger.log(`${fecha}: ${kpis.registrosPorFecha[fecha] || 0} registros`);
    });
      // Continuar con la respuesta HTML normal
    Logger.log("📄 Preparando respuesta HTML normal");
    
    return template.evaluate()
      .setTitle('Panel AgroActiva 2025 - 4-7 Junio - PostVenta D&E')
      .setFaviconUrl('https://i.ibb.co/zhBxGWLt/SP-Icon.png')
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

      // CORRECCIÓN: Mejorar el parsing de fechas
      const [dia, mes, año] = fechaTexto.split('/');
      
      // Asegurar que día y mes tengan 2 dígitos
      const diaFormateado = dia.padStart(2, '0');
      const mesFormateado = mes.padStart(2, '0');
      
      // Crear la fecha de forma más robusta
      const fechaFormateada = `${año}-${mesFormateado}-${diaFormateado}`;
      
      Logger.log(`Registro ${index + 1}:`);
      Logger.log(`  Fecha texto: ${fechaTexto}`);
      Logger.log(`  Componentes: día=${dia}, mes=${mes}, año=${año}`);
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
  const fechasEsperadas = ['2025-06-04', '2025-06-05', '2025-06-06', '2025-06-07'];
  fechasEsperadas.forEach(fecha => {
    Logger.log(`${fecha}: ${registrosPorFecha[fecha] || 0} registros`);
  });
  // 2. Visitantes por Hora
  const visitantesPorHora = data.reduce((acc, item) => {
    try {
      const [fecha, hora] = item["Marca temporal"].split(" ");
      
      // CORRECCIÓN: Usar función mejorada de conversión de fecha
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
  Logger.log("\n=== PROCESAMIENTO DE VERTICALES ===");
  Logger.log("Configuración de verticales:");
  verticales.forEach(vertical => {
    Logger.log(`${vertical.nombre}: columna ${vertical.columna}`);
  });
  
  // Mapeo más robusto de verticales usando nombres de columna en lugar de índices
  const columnasVerticales = {
    "WeedSeeker": ["WeedSeeker", "Vertical WeedSeeker", "weedseeker"],
    "Drones DJI": ["Drones DJI", "Vertical Drones DJI", "drones"],
    "Siembra": ["Siembra", "Vertical Siembra", "siembra"],
    "Pulverización": ["Pulverización", "Vertical Pulverización", "pulverizacion"],
    "Técnica": ["Técnica", "Vertical Técnica", "tecnica"],
    "Guía y Autoguía": ["Guía y Autoguía", "Vertical Guía y Autoguía", "guia"],
    "Taps - Señales": ["Taps - Señales", "Vertical Taps - Señales", "taps_senales"],
    "TAPs - Acción Café": ["TAPs - Acción Café", "Vertical TAPs - Acción Café", "taps_cafe"]
  };
  
  // Mostrar las columnas disponibles
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    Logger.log("\nColumnas disponibles en los datos:");
    headers.forEach((header, index) => {
      Logger.log(`${index + 1}: "${header}"`);
    });
  }
  
  const totalesVerticales = {};
  verticales.forEach(vertical => {
    const columnaIndex = vertical.columna - 1;
    
    // Intentar acceso por índice
    let valoresEncontrados = 0;
    let valorEjemplo = null;
    
    valoresEncontrados = data.filter(item => {
      const valores = Object.values(item);
      if (columnaIndex < valores.length) {
        const valor = valores[columnaIndex];
        if (!valorEjemplo && valor) valorEjemplo = valor;
        return valor === "TRUE" || valor === true || valor === "1" || valor === 1;
      }
      return false;
    }).length;
    
    totalesVerticales[vertical.nombre] = valoresEncontrados;
    
    Logger.log(`\nVertical "${vertical.nombre}":`);
    Logger.log(`  Columna índice: ${columnaIndex}`);
    Logger.log(`  Valores encontrados: ${valoresEncontrados}`);
    Logger.log(`  Valor ejemplo: "${valorEjemplo}"`);
  });
  // 3.1 Interés por Verticales por Fecha - VERSIÓN CORREGIDA
  Logger.log("\n=== PROCESAMIENTO VERTICALES POR FECHA (CORREGIDO) ===");
  const verticalesPorFecha = {};
  // Inicializar estructura de fechas
  const fechasUnicas = new Set();
  data.forEach(item => {
    try {
      const fechaTexto = item.AuxFecha;
      if (fechaTexto) {
        // CORRECCIÓN: Mejorar el parsing de fechas
        const [dia, mes, año] = fechaTexto.split('/');
        const diaFormateado = dia.padStart(2, '0');
        const mesFormateado = mes.padStart(2, '0');
        const fechaFormateada = `${año}-${mesFormateado}-${diaFormateado}`;
        fechasUnicas.add(fechaFormateada);
      }
    } catch (error) {
      Logger.log("Error procesando fecha para inicialización: " + error.message);
    }
  });

  Logger.log("Fechas únicas encontradas: " + Array.from(fechasUnicas).join(', '));

  // Inicializar todas las fechas con todas las verticales
  fechasUnicas.forEach(fecha => {
    verticalesPorFecha[fecha] = {};
    verticales.forEach(vertical => {
      verticalesPorFecha[fecha][vertical.nombre] = 0;
    });
  });

  Logger.log("Estructura inicializada para verticalesPorFecha:");
  Logger.log(JSON.stringify(verticalesPorFecha, null, 2));
  // Procesar cada registro
  let registrosProcesados = 0;
  data.forEach((item, itemIndex) => {
    try {
      const fechaTexto = item.AuxFecha;
      if (!fechaTexto) {
        Logger.log("Registro " + (itemIndex + 1) + ": Sin AuxFecha");
        return;
      }

      // CORRECCIÓN: Mejorar el parsing de fechas
      const [dia, mes, año] = fechaTexto.split('/');
      const diaFormateado = dia.padStart(2, '0');
      const mesFormateado = mes.padStart(2, '0');
      const fechaFormateada = `${año}-${mesFormateado}-${diaFormateado}`;
      
      // Procesar cada vertical para este registro
      verticales.forEach(vertical => {
        const columnaIndex = vertical.columna - 1;
        const valores = Object.values(item);
        
        if (columnaIndex < valores.length) {
          const valor = valores[columnaIndex];
          if (valor === "TRUE" || valor === true || valor === "1" || valor === 1) {
            verticalesPorFecha[fechaFormateada][vertical.nombre]++;
            
            // Logging para los primeros 10 registros
            if (registrosProcesados < 10) {
              Logger.log("Registro " + (itemIndex + 1) + ", Fecha " + fechaFormateada + ", Vertical " + vertical.nombre + ": INCREMENTADO");
            }
          }
        }
      });
      
      registrosProcesados++;
    } catch (error) {
      Logger.log("Error procesando verticales por fecha en registro " + (itemIndex + 1) + ": " + error.message);
    }
  });

  Logger.log("\nTotal de registros procesados para verticales por fecha: " + registrosProcesados);

  // Logging de resultados finales
  Logger.log("\nResultados finales de verticalesPorFecha:");
  Object.entries(verticalesPorFecha).forEach(([fecha, verticales]) => {
    Logger.log("Fecha " + fecha + ":");
    Object.entries(verticales).forEach(([nombre, cantidad]) => {
      if (cantidad > 0) {
        Logger.log("  " + nombre + ": " + cantidad);
      }
    });
  });
  
  // Logging de resultados
  Logger.log("\nResultados finales de verticales:");
  Logger.log("Totales verticales:");
  Object.entries(totalesVerticales).forEach(([nombre, total]) => {
    Logger.log(`  ${nombre}: ${total}`);
  });
  
  Logger.log("\nVerticales por fecha:");
  Object.entries(verticalesPorFecha).forEach(([fecha, verticales]) => {
    Logger.log(`  ${fecha}:`);
    Object.entries(verticales).forEach(([nombre, cantidad]) => {
      if (cantidad > 0) {
        Logger.log(`    ${nombre}: ${cantidad}`);
      }
    });
  });

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
  Logger.log("\n=== PROCESAMIENTO GEOGRÁFICO ===");
  
  // Mostrar las columnas disponibles para depuración
  if (data.length > 0) {
    const primeraFila = data[0];
    Logger.log("Columnas disponibles para localidades y provincias:");
    Object.keys(primeraFila).forEach((key, index) => {
      Logger.log(`${index + 1}: "${key}"`);
    });
    
    // Buscar columnas que puedan contener información geográfica
    const columnasGeo = Object.keys(primeraFila).filter(key => 
      key.toLowerCase().includes('localidad') || 
      key.toLowerCase().includes('provincia') ||
      key.toLowerCase().includes('ciudad') ||
      key.toLowerCase().includes('lugar')
    );
    Logger.log("Columnas geográficas encontradas:", columnasGeo);
  }
  
  const localidades = data.reduce((acc, item) => {
    // Intentar múltiples variaciones del nombre de la columna
    let localidad = item.Localidad || item.localidad || item.LOCALIDAD || 
                   item['Localidad:'] || item['localidad:'] || 
                   item.Ciudad || item.ciudad || item.CIUDAD || "";
    
    if (localidad && localidad.trim() !== "") {
      localidad = localidad.trim();
      acc[localidad] = (acc[localidad] || 0) + 1;
    } else {
      // Logging para depuración cuando no se encuentra localidad
      const keys = Object.keys(item);
      Logger.log(`Registro sin localidad válida. Columnas disponibles: ${keys.slice(0, 5).join(', ')}...`);
    }
    return acc;
  }, {});
  
  const provincias = data.reduce((acc, item) => {
    // Intentar múltiples variaciones del nombre de la columna
    let provincia = item.Provincia || item.provincia || item.PROVINCIA || 
                   item['Provincia:'] || item['provincia:'] || "";
    
    if (provincia && provincia.trim() !== "") {
      provincia = provincia.trim();
      acc[provincia] = (acc[provincia] || 0) + 1;
    } else {
      // Logging para depuración cuando no se encuentra provincia
      const keys = Object.keys(item);
      Logger.log(`Registro sin provincia válida. Columnas disponibles: ${keys.slice(0, 5).join(', ')}...`);
    }
    return acc;
  }, {});
  
  // Logging de resultados geográficos
  Logger.log(`\nLocalidades encontradas (${Object.keys(localidades).length}):`);
  Object.entries(localidades)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([localidad, count]) => {
      Logger.log(`  "${localidad}": ${count}`);
    });
  
  Logger.log(`\nProvincias encontradas (${Object.keys(provincias).length}):`);
  Object.entries(provincias)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([provincia, count]) => {
      Logger.log(`  "${provincia}": ${count}`);
    });

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
    }, {});  // Logging final
  Logger.log("Datos procesados:");
  Logger.log("Total registros: " + data.length);
  Logger.log("Registros por fecha: " + JSON.stringify(registrosPorFecha));
  Logger.log("Registros por asignado: " + JSON.stringify(registrosPorAsignado));
  Logger.log("Totales verticales: " + JSON.stringify(totalesVerticales));
  Logger.log("Verticales por fecha: " + JSON.stringify(verticalesPorFecha));
  Logger.log("Localidades ordenadas: " + JSON.stringify(localidadesOrdenadas));
  Logger.log("Provincias ordenadas: " + JSON.stringify(provinciasOrdenadas));

  return {
    registrosPorFecha: registrosPorFecha,
    totalRegistros: data.length,
    visitantesPorHora: visitantesPorHora,
    totalesVerticales: totalesVerticales,
    verticalesPorFecha: verticalesPorFecha,
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
