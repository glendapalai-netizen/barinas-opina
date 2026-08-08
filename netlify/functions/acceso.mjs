import { getStore } from "@netlify/blobs";

// Puerta del informe. Sin correo y sin Google: cada quien tiene su usuario y su
// clave propia, y la primera vez está obligado a cambiarla.
//
// Dos cosas que no se negocian aquí:
//  · la clave NUNCA se guarda tal cual, solo su huella (PBKDF2 con sal propia);
//  · quien entra recibe un pase firmado que vence, no una llave permanente.

const VUELTAS = 210_000;                 // costo del hashing, alto a propósito
const VIGENCIA = 12 * 60 * 60 * 1000;    // el pase dura 12 horas
const TOPE_FALLOS = 8;                   // después de esto, la cuenta se traba
const INICIAL = "12345";                 // clave de estreno, hay que cambiarla

// El secreto con que se firman los pases.
//
// Antes había aquí un valor de respaldo escrito a mano, y como este repositorio
// es público, cualquiera que lo leyera podía firmarse un pase y entrar al
// informe sin usuario ni clave. Un secreto que está publicado no es un secreto.
//
// Ahora, si no hay variable de entorno, se inventa uno al azar la primera vez y
// se guarda: no está en el código, no está en el repositorio, y a nadie le toca
// acordarse de ponerlo. Aun así conviene poner SECRETO_ACCESO en Netlify —manda
// sobre este— porque así se puede rotar a voluntad si alguna vez hace falta.
let enMemoria = null;
async function secreto() {
  if (process.env.SECRETO_ACCESO) return process.env.SECRETO_ACCESO;
  if (enMemoria) return enMemoria;
  const store = getStore("consulta-barinas");
  let s = await store.get("sys/secreto", { type: "text", consistency: "strong" });
  if (!s) {
    s = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await store.set("sys/secreto", s);
    // Por si dos arranques simultáneos lo inventaron a la vez: gana el guardado.
    s = await store.get("sys/secreto", { type: "text", consistency: "strong" }) || s;
  }
  return enMemoria = s;
}

// Los dos de la directiva. Si mañana entra alguien más, se agrega aquí y en el
// próximo despliegue aparece con su clave de estreno.
const GENTE = {
  cle:      "Glenda Palai",
  humberto: "Humberto",
};

const b64 = b => Buffer.from(b).toString("base64url");

async function huella(clave, sal) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: VUELTAS }, material, 256);
  return b64(new Uint8Array(bits));
}

// Comparación en tiempo constante: si se compara con === , el tiempo de
// respuesta filtra cuántos caracteres acertó quien está probando.
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function firmar(texto) {
  const llave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(await secreto()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(texto));
  return b64(new Uint8Array(f));
}

async function darPase(usuario) {
  const cuerpo = `${usuario}.${Date.now() + VIGENCIA}`;
  return `${b64(cuerpo)}.${await firmar(cuerpo)}`;
}

// Se exporta porque la función del informe la usa para dejar pasar o no.
export async function revisarPase(pase) {
  if (!pase || !pase.includes(".")) return null;
  const [parte, firma] = pase.split(".");
  let cuerpo;
  try { cuerpo = Buffer.from(parte, "base64url").toString(); } catch { return null; }
  if (!iguales(firma, await firmar(cuerpo))) return null;
  const [usuario, vence] = cuerpo.split(".");
  if (!usuario || Number(vence) < Date.now()) return null;
  return usuario;
}

async function traer(store, usuario) {
  let f = await store.get(`u/${usuario}`, { type: "json", consistency: "strong" });
  if (!f) {
    // Primera vez que se le pregunta por esta persona: se le crea con la de estreno.
    const sal = crypto.getRandomValues(new Uint8Array(16));
    f = {
      nombre: GENTE[usuario],
      sal: b64(sal),
      huella: await huella(INICIAL, sal),
      estrenando: true,
      fallos: 0,
      visto: null,
    };
    await store.setJSON(`u/${usuario}`, f);
  }
  return f;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const store = getStore("consulta-barinas");
  let d;
  try { d = await req.json(); } catch { return Response.json({ error: "json inválido" }, { status: 400 }); }

  const usuario = String(d.usuario || "").trim().toLowerCase();
  const clave = String(d.clave || "");

  // Usuario desconocido: se responde igual que con clave mala, para no delatar
  // qué nombres existen.
  if (!GENTE[usuario] || !clave) {
    return Response.json({ error: "Usuario o clave incorrectos." }, { status: 401 });
  }

  const f = await traer(store, usuario);
  if (f.fallos >= TOPE_FALLOS) {
    return Response.json({ error: "Cuenta bloqueada por intentos fallidos. Avísale a Cle." }, { status: 423 });
  }

  const sal = Buffer.from(f.sal, "base64url");
  if (!iguales(f.huella, await huella(clave, sal))) {
    f.fallos = (f.fallos || 0) + 1;
    await store.setJSON(`u/${usuario}`, f);
    const quedan = TOPE_FALLOS - f.fallos;
    return Response.json({
      error: quedan > 0 && quedan <= 3
        ? `Usuario o clave incorrectos. Te quedan ${quedan} intentos.`
        : "Usuario o clave incorrectos.",
    }, { status: 401 });
  }

  // --- Cambio de clave ------------------------------------------------------
  if (d.nueva !== undefined) {
    const nueva = String(d.nueva);
    if (nueva.length < 8) {
      return Response.json({ error: "La clave nueva debe tener al menos 8 caracteres." }, { status: 400 });
    }
    if (nueva === INICIAL || iguales(f.huella, await huella(nueva, sal))) {
      return Response.json({ error: "Tiene que ser distinta a la que ya tenías." }, { status: 400 });
    }
    const salNueva = crypto.getRandomValues(new Uint8Array(16));
    Object.assign(f, {
      sal: b64(salNueva),
      huella: await huella(nueva, salNueva),
      estrenando: false,
      fallos: 0,
      visto: Date.now(),
    });
    await store.setJSON(`u/${usuario}`, f);
    return Response.json({ ok: true, nombre: f.nombre, pase: await darPase(usuario) });
  }

  // --- Entrada normal -------------------------------------------------------
  if (f.estrenando) {
    // Con la clave de estreno se entra, pero no se pasa: primero se cambia.
    return Response.json({ ok: true, estrenando: true, nombre: f.nombre });
  }

  f.fallos = 0;
  f.visto = Date.now();
  await store.setJSON(`u/${usuario}`, f);
  return Response.json({ ok: true, nombre: f.nombre, pase: await darPase(usuario) });
};

export const config = { path: "/api/acceso" };
