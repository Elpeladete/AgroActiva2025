// Config.gs

// Configuración general
const CONFIG = {
  // URLs
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT0BHePqF9yfxyNW9uG70JxvbKqRT7qt9uQ9g9Szqq1HukUiAW4141qp1EXzp2IgL8Z1jVVZZDSxuHP/pub?gid=1689140406&single=true&output=csv",
  
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
  APP_TITLE: 'Panel ExpoAgro',
  APP_DESCRIPTION: 'Panel de control para ExpoAgro 2025',
  
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
