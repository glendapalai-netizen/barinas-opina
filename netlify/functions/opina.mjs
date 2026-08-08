import { getStore } from "@netlify/blobs";
import { revisarPase } from "./acceso.mjs";

// Recoge las respuestas de la consulta y lleva la cuenta.
// Guardar es barato; lo caro sería perder una respuesta, así que cada una va
// a su propia llave y el contador se recalcula, nunca se asume.

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
      const cols = ["cuando", "rubro", "direccion", "coordinacion", "municipio", "tamano",
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
      await store.setJSON(`m/${cuando}-${crypto.randomUUID().slice(0, 8)}`,
                          { cuando, nombre, telefono, mensaje, leido: false });
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
      direccion: corta(d.direccion, 120),
      coordinacion: corta(d.coordinacion, 120),
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

    const { blobs } = await store.list({ prefix: "r/" });
    return Response.json({ ok: true, id, total: blobs.length });
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/opina" };
