// El respaldo en Airtable.
//
// La fuente sigue siendo este sitio: Airtable es la copia y el escritorio donde
// la Cámara trabaja los recados. Si algún día no coinciden, manda el sitio.
//
// Por eso todo aquí falla en silencio. Perder el respaldo de una respuesta es
// molesto; perder la respuesta porque Airtable estaba caído sería imperdonable.
// Sin llave configurada, esto no hace nada y nadie se entera.

const BASE = "app1PC3zwRyMHoG1g";
const RESPUESTAS = "Respuestas";
const RECADOS = "Recados";

const hay = () => !!process.env.AIRTABLE_LLAVE;

async function llamar(tabla, metodo, cuerpo) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(tabla)}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${process.env.AIRTABLE_LLAVE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`airtable ${r.status}: ${await r.text()}`);
  return r.json();
}

// Airtable rechaza el registro entero si una opción no existe en la lista. Como
// las listas de la consulta y las de la base se pueden desincronizar con el
// tiempo, se le pide que agregue la opción que no conozca en vez de fallar.
const PERMISO = { typecast: true };

export async function guardarRespuesta(id, fila, direcciones) {
  if (!hay()) return;
  const campos = {
    "Llave": id,
    "Fecha": new Date(fila.cuando).toISOString(),
    "Sector": fila.rubro || [],
    "Otro sector": fila.otro_rubro || "",
    "Vínculo con el turismo": fila.vinculo || "",
    "Dirección CADTEBA": direcciones || [],
    "Municipio": fila.municipio || "",
    "Tamaño": fila.tamano || "",
    "Temporadas": fila.momentos || [],
    "Días al año": fila.dias || "",
    "Ocupación": fila.ocupacion || "",
    "Tributos que aprietan": fila.impuestos || [],
    "Otro tributo": fila.otro_impuestos || "",
    "Prioridad número uno": fila.uno || "",
    "Cuál otro": fila.otro_uno || "",
    "Por qué": fila.porque_uno || "",
    "Qué hace falta": fila.cambios || [],
    "Otra medida": fila.otro_cambios || "",
    "Para invertir o contratar": fila.inversion || [],
    "Otra cosa para invertir": fila.otro_inversion || "",
    "Calidad general de servicios": fila.calidad_servicios || "",
    "Servicio a atender primero": fila.prioridad_servicio || "",
    // Las once frases del deslizador caben en un solo campo: el análisis por
    // frase ya lo hace el tablero, aquí sólo hace falta que no se pierdan.
    "Consenso": Object.entries(fila.acuerdos || {})
                      .map(([f, v]) => `${f} → ${v}`).join("\n"),
    "Valoración": fila.valoracion === "" ? null : Number(fila.valoracion),
    "Prestador": fila.negocio || "",
    "Nombre": fila.nombre || "",
    "WhatsApp": fila.telefono || "",
    "Correo": fila.correo || "",
    "Instagram": fila.instagram || "",
    "Web": fila.web || "",
    "Afiliación": fila.afiliado || "",
  };
  // Cada servicio tiene su propia columna, para poder filtrar por él.
  for (const [nombre, nota] of Object.entries(fila.servicios || {})) campos[nombre] = nota;

  // Se busca por «Llave» y se pisa: una respuesta que se completa después tiene
  // que caer en su misma fila, no crear otra.
  await llamar(RESPUESTAS, "PATCH", {
    ...PERMISO,
    performUpsert: { fieldsToMergeOn: ["Llave"] },
    records: [{ fields: campos }],
  });
}

export async function guardarRecado(m) {
  if (!hay()) return;
  await llamar(RECADOS, "POST", {
    ...PERMISO,
    records: [{ fields: {
      "Nombre": m.nombre,
      "Fecha": new Date(m.cuando).toISOString(),
      "WhatsApp": m.telefono,
      "Mensaje": m.mensaje,
      "Estado": "Sin atender",   // llega como tarea pendiente, que es lo que es
    } }],
  });
}
