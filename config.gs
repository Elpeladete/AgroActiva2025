// Config.gs

// Configuración general
const CONFIG = {
  // URLs
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSpl2Xw0_2YoA5CtVENqljNrdOREAClvkAXXON8sNytqzq0f_GPN7xx2lBfTm0sMQsSk0hya0bjnJGf/pub?gid=1689140406&single=true&output=csv",
  
  // Caché
  CACHE_KEY: 'CSV_DATA_CACHE',
  CACHE_DURATION: 21600, // 6 horas en segundos
  
  // Verticales
  VERTICALES: [
    "WeedSeeker",
    "Drones DJI",
    "Siembra",
    "Pulverización",
    "Técnica",
    "Guía y autoguía",
    "TAPs Señales",
    "TAPs Acción Café"
  ],
  
  // Headers requeridos
  REQUIRED_HEADERS: [
    "Timestamp",
    "Agente Comercial",
    "Localidad",
    "Provincia"
  ],
  
  // Configuración de la aplicación
  APP_TITLE: 'Panel AgroActiva 2025 - 4-7 Junio - PostVenta D&E',
  APP_DESCRIPTION: 'Panel de control para AgroActiva 2025 (4-7 Junio)',
  
  // Configuración de visualización
  CHART_COLORS: [
    '#4285f4',
    '#34a853',
    '#fbbc05',
    '#ea4335',
    '#46bdc6',
    '#7986cb',
    '#8bc34a',
    '#ff7043'
  ]
};

// Exportar configuración
function getConfig() {
  return CONFIG;
} 
