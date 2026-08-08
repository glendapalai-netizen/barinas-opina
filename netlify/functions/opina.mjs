import { getStore } from "@netlify/blobs";
import { revisarPase } from "./acceso.mjs";
import { guardarRespuesta, guardarRecado } from "./airtable.mjs";

// La misma tabla que usan la consulta y el tablero. Vive aquí también porque el
// respaldo en Airtable guarda la dirección ya resuelta: allá no hay quien la
// deduzca al leer.
const SECTOR_DIRECCION = {
  "Hoteleros":                                "Gestión de Calidad y Hospitalidad",
  "Restaurantes | Catering":                  "Gestión de Calidad y Hospitalidad",
  "Auditoría de Calidad":                     "Gestión de Calidad y Hospitalidad",

  "Clínicas":                                 "Turismo de Salud, Bienestar y Vida",
  "Spa":                                      "Turismo de Salud, Bienestar y Vida",
  "Profesional de la salud":                  "Turismo de Salud, Bienestar y Vida",
  "Salud holística":                          "Turismo de Salud, Bienestar y Vida",
  "Farmacéutico":                             "Turismo de Salud, Bienestar y Vida",
  "Laboratorios Bio análisis":                "Turismo de Salud, Bienestar y Vida",

  "Deportes y fitness":                       "Deportes Extremos y Aventura",
  "Deportes extremos":                        "Deportes Extremos y Aventura",

  "Agroindustria":                            "Agroturismo y Producción",
  "Campo y ganadería":                        "Agroturismo y Producción",
  "Cacao | Café | Cereales":                  "Agroturismo y Producción",
  "Alimentos y bebidas masivo":               "Agroturismo y Producción",
  "Industria química":                        "Agroturismo y Producción",

  "Arquitectura | Construcción | Ferretero":  "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Mecánica y eléctrica":                     "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Transporte y maquinaria pesada":           "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Inmobiliario":                             "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Inversión y finanzas":                     "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Petrolero":                                "Infraestructura, Seguridad y Desarrollo Sustentable",
  "Sector público":                           "Infraestructura, Seguridad y Desarrollo Sustentable",

  "Educación":                                "Educación, Cultura y Economía Naranja",
  "Economía naranja":                         "Educación, Cultura y Economía Naranja",
  "Fotografía | Cine | Audiovisual":          "Educación, Cultura y Economía Naranja",
  "Ciencias económicas y sociales":           "Educación, Cultura y Economía Naranja",
  "ONG":                                      "Educación, Cultura y Economía Naranja",
  "Filantrópico":                             "Educación, Cultura y Economía Naranja",

  "Transporte turístico":                     "Mercadeo, Productos y Relaciones Internacionales",
  "Operador turístico | Guías | Agencias viaje": "Mercadeo, Productos y Relaciones Internacionales",
  "Mercadeo":                                 "Mercadeo, Productos y Relaciones Internacionales",
  "Comercio Exterior":                        "Mercadeo, Productos y Relaciones Internacionales",
  "Comercio | Boutiques | Moda":              "Mercadeo, Productos y Relaciones Internacionales",
  "Supermercados | Alimentos | Misceláneos":  "Mercadeo, Productos y Relaciones Internacionales",
  "Agencia festejos | Decoración | Eventos":  "Mercadeo, Productos y Relaciones Internacionales",
  "Consultoría legal":                        "Mercadeo, Productos y Relaciones Internacionales",
};

// Recoge las respuestas de la consulta y lleva la cuenta.
// Guardar es barato; lo caro sería perder una respuesta, así que cada una va
// a su propia llave y el contador se recalcula, nunca se asume.

// El respaldo se espera, pero nunca se deja que tumbe la respuesta.
//
// Antes se mandaba sin esperar, y el recado no llegaba nunca: la función se
// congela apenas devuelve, y al envío no le daba tiempo de salir. Se espera,
// pues —son unas décimas— y si falla, se anota en la bitácora y se sigue como
// si nada. Lo guardado aquí ya está a salvo antes de llegar a esta línea.
async function respaldar(hacer) {
  try { await hacer(); } catch (e) { console.warn("respaldo airtable:", e.message); }
}

const LIMITE = 20_000; // ninguna respuesta legítima pesa más que esto

export default async (req) => {
  const store = getStore("consulta-barinas");
  const url = new URL(req.url);

  // --- El informe, para CADTEBA -------------------------------------------
  if (req.method === "GET") {
    // El pase viaja en la cabecera; para la descarga del CSV, que la dispara el
    // navegador y no lleva cabeceras, se acepta también por la dirección.
    const pase = (req.headers.get("authorization") || "").replace(/^Bearer /, "")
                 || url.searchParams.get("pase");
    const quien = await revisarPase(pase);
    if (!quien) return Response.json({ error: "no autorizado" }, { status: 401 });
    const { blobs } = await store.list({ prefix: "r/" });
    const filas = [];
    for (const b of blobs) {
      const d = await store.get(b.key, { type: "json", consistency: "strong" });
      if (d) filas.push(d);
    }
    filas.sort((a, b) => (a.cuando || 0) - (b.cuando || 0));

    if (url.searchParams.get("csv")) {
      const cols = ["cuando", "rubro", "otro_rubro", "municipio", "tamano",
                    "momentos", "dias", "ocupacion",
                    "impuestos", "otro_impuestos",
                    "cambios", "otro_cambios",
                    "uno", "otro_uno", "porque_uno",
                    "inversion", "otro_inversion",
                    "calidad_servicios", "prioridad_servicio", "valoracion",
                    "negocio", "nombre", "telefono", "correo", "instagram", "web", "afiliado"];
      // Cada frase del deslizador es su propia columna, para poder tabularla en
      // Excel. Se recogen de todas las respuestas por si el listado cambió en el
      // camino: así ninguna frase vieja se pierde.
      const frases = [...new Set(filas.flatMap(f => Object.keys(f.acuerdos || {})))];
      const servs = [...new Set(filas.flatMap(f => Object.keys(f.servicios || {})))];
      const esc = v => `"${String(Array.isArray(v) ? v.join(" | ") : v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        [...cols, ...servs.map(s => `servicio: ${s}`),
                  ...frases.map(f => `acuerdo: ${f}`)].map(esc).join(","),
        ...filas.map(f => [
          ...cols.map(c => esc(c === "cuando" ? new Date(f.cuando).toISOString() : f[c])),
          ...servs.map(sv => esc((f.servicios || {})[sv])),
          ...frases.map(fr => esc((f.acuerdos || {})[fr])),
        ].join(",")),
      ].join("\n");
      return new Response("﻿" + csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="consulta-barinas.csv"',
        },
      });
    }
    const { blobs: sobres } = await store.list({ prefix: "m/" });
    const mensajes = [];
    for (const b of sobres) {
      const m = await store.get(b.key, { type: "json", consistency: "strong" });
      if (m) mensajes.push(m);
    }
    mensajes.sort((a, b) => (b.cuando || 0) - (a.cuando || 0));

    return Response.json({ total: filas.length, respuestas: filas, mensajes });
  }

  // --- Una respuesta nueva -------------------------------------------------
  if (req.method === "POST") {
    const texto = await req.text();
    if (!texto || texto.length > LIMITE) return Response.json({ error: "muy grande" }, { status: 413 });

    let d;
    try { d = JSON.parse(texto); } catch { return Response.json({ error: "json inválido" }, { status: 400 }); }
    const corta = (v, n) => String(v || "").slice(0, n);
    const lista = v => (Array.isArray(v) ? v.slice(0, 20).map(x => corta(x, 120)) : []);

    // --- Un recado para la Cámara, que no es una respuesta a la consulta ---
    if (url.searchParams.get("mensaje")) {
      const nombre = corta(d.nombre, 100), telefono = corta(d.telefono, 30), mensaje = corta(d.mensaje, 3000);
      if (nombre.length < 2 || telefono.length < 7 || mensaje.length < 5) {
        return Response.json({ error: "faltan datos" }, { status: 400 });
      }
      const cuando = Date.now();
      const recado = { cuando, nombre, telefono, mensaje, leido: false };
      await store.setJSON(`m/${cuando}-${crypto.randomUUID().slice(0, 8)}`, recado);
      await respaldar(() => guardarRecado(recado));
      return Response.json({ ok: true });
    }

    if (!d.municipio) return Response.json({ error: "faltan datos" }, { status: 400 });

    // La respuesta se guarda antes de pedir el contacto y se completa después.
    // Por eso la llave viaja de vuelta: el segundo envío sobrescribe el mismo
    // registro en vez de crear uno nuevo. Una persona, una fila.
    let id = corta(d.id, 80);
    let previa = null;
    if (id && id.startsWith("r/") && !id.includes("..")) {
      previa = await store.get(id, { type: "json", consistency: "strong" });
    }
    if (!previa) { id = null; }

    const cuando = previa ? previa.cuando : Date.now();
    const fila = {
      cuando,
      completada: Date.now(),
      rubro: lista(d.rubro),
      otro_rubro: corta(d.otro_rubro, 160),
      municipio: corta(d.municipio, 80),
      tamano: corta(d.tamano, 60),
      momentos: lista(d.momentos),
      dias: corta(d.dias, 60),
      ocupacion: corta(d.ocupacion, 60),
      impuestos: lista(d.impuestos),
      otro_impuestos: corta(d.otro_impuestos, 160),
      cambios: lista(d.cambios),
      otro_cambios: corta(d.otro_cambios, 160),
      uno: corta(d.uno, 120),
      otro_uno: corta(d.otro_uno, 160),
      porque_uno: corta(d.porque_uno, 1200),
      inversion: lista(d.inversion),
      otro_inversion: corta(d.otro_inversion, 160),
      acuerdos: d.acuerdos && typeof d.acuerdos === "object" ? d.acuerdos : {},
      servicios: d.servicios && typeof d.servicios === "object" ? d.servicios : {},
      calidad_servicios: corta(d.calidad_servicios, 60),
      prioridad_servicio: corta(d.prioridad_servicio, 1200),
      valoracion: d.valoracion === "" || d.valoracion === undefined ? "" : Number(d.valoracion),
      negocio: corta(d.negocio, 120),
      nombre: corta(d.nombre, 100),
      telefono: corta(d.telefono, 30),
      correo: corta(d.correo, 120),
      instagram: corta(d.instagram, 120),
      web: corta(d.web, 160),
      afiliado: corta(d.afiliado, 60),
    };

    if (!id) id = `r/${cuando}-${crypto.randomUUID().slice(0, 8)}`;
    await store.setJSON(id, fila);

    const direcciones = [...new Set(fila.rubro.map(r => SECTOR_DIRECCION[r]).filter(Boolean))];
    await respaldar(() => guardarRespuesta(id, fila, direcciones));

    const { blobs } = await store.list({ prefix: "r/" });
    return Response.json({ ok: true, id, total: blobs.length });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/opina" };
