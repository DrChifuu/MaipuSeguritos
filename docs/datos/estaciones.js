// Archivo generado por fuente_sqlite.py — no editar a mano.
// Datos de la base de Maipo Vigía (SQLite): los acumulados y los estados salen de los registros.
// Los seis puntos son la tabla maestra (datos/puntos.py); sin lectura son sin_datos y su
// acumulado es null, nunca 0 mm. La ventana de 24 h se informa con las marcas reales que cubre.
// El estado de acceso lo declara una persona o un documento; sin fuente y sin hora es
// sin_informacion. El color del semáforo no se publica: se calcula con umbrales_version vigente.
// window.ESTACIONES es un arreglo con una entrada por punto de medición; los campos
// derivados salen de window.REGISTROS.measurements agrupado por station_id
// (ver panel-web/datos/estaciones.py y panel-web/estaciones.md).

window.ESTACIONES = [
  {
    "id": "SJM-PLAZA-01",
    "nombre": "Estación Plaza de Armas",
    "quebrada": null,
    "sector": "San José de Maipo, sector Plaza de Armas (ubicación aproximada)",
    "elevacion_m": 1080,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": false,
      "documento": "panel-web/especificacion.md",
      "linea": 53,
      "nota": "Punto del panel v0, con lecturas simuladas. La altura de 1080 m es la de la ficha del simulador (panel-web/datos/generar_datos.py:41): no está medida ni levantada en terreno. La ubicación es aproximada y no hay coordenadas ni quebrada declaradas."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  },
  {
    "id": "SJM-SANGABRIEL-01",
    "nombre": "San Gabriel",
    "quebrada": null,
    "sector": "San Gabriel",
    "elevacion_m": null,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": true,
      "documento": "Chat_Maipo_exportado_2026-10-25.txt",
      "linea": 173,
      "nota": "Sector listado como zona de mayor exposición del Cajón del Maipo en material del equipo sin fuente primaria citada; también en las líneas 143 y 237 del mismo archivo. Punto propuesto: sin sensor, sin visita y sin lecturas. Ver panel-web/estaciones.md §8."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  },
  {
    "id": "SJM-MANZANO-01",
    "nombre": "El Manzano",
    "quebrada": null,
    "sector": "El Manzano",
    "elevacion_m": null,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": true,
      "documento": "Chat_Maipo_exportado_2026-10-25.txt",
      "linea": 173,
      "nota": "Sector listado como zona de mayor exposición del Cajón del Maipo en material del equipo sin fuente primaria citada; también en la línea 237 del mismo archivo. Punto propuesto: sin sensor, sin visita y sin lecturas. Ver panel-web/estaciones.md §8."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  },
  {
    "id": "SJM-CANELO-01",
    "nombre": "El Canelo",
    "quebrada": null,
    "sector": "El Canelo",
    "elevacion_m": null,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": true,
      "documento": "Chat_Maipo_exportado_2026-10-25.txt",
      "linea": 173,
      "nota": "Sector listado como zona de mayor exposición del Cajón del Maipo en material del equipo sin fuente primaria citada; también en la línea 237 del mismo archivo. Punto propuesto: sin sensor, sin visita y sin lecturas. Ver panel-web/estaciones.md §8."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  },
  {
    "id": "SJM-SANALFONSO-01",
    "nombre": "San Alfonso",
    "quebrada": "Estero San Alfonso",
    "sector": "San Alfonso",
    "elevacion_m": null,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": true,
      "documento": "MaipuSeguritos/bitacora/S03.md",
      "linea": 41,
      "nota": "La bitácora S03 nombra la cuenca del estero San Alfonso al describir el piloto de monitoreo de SERNAGEOMIN. El sector aparece además en el material del equipo (Chat_Maipo_exportado_2026-10-25.txt:173 y :237). Punto propuesto: sin sensor, sin visita y sin lecturas."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  },
  {
    "id": "SJM-MELOCOTON-01",
    "nombre": "El Melocotón",
    "quebrada": null,
    "sector": "El Melocotón",
    "elevacion_m": null,
    "estado_dato": "sin_datos",
    "ultima_lectura": null,
    "lecturas": 0,
    "lecturas_manuales": 0,
    "acumulado_24h_mm": null,
    "acumulado_24h_desde": null,
    "acumulado_24h_hasta": null,
    "referencia_dato": "2026-11-23T00:15:49-03:00",
    "procedencia": {
      "propuesto": true,
      "documento": "Chat_Maipo_exportado_2026-10-25.txt",
      "linea": 237,
      "nota": "Sector listado entre las localidades vulnerables del Cajón del Maipo en material del equipo sin fuente primaria citada; también en la línea 143 del mismo archivo. Punto propuesto: sin sensor, sin visita y sin lecturas. Ver panel-web/estaciones.md §8."
    },
    "acceso": {
      "estado": "sin_informacion",
      "actualizado": null,
      "fuente": null,
      "nota": "Sin información de acceso: no hay una constatación registrada sobre si se puede llegar a este punto."
    }
  }
];
