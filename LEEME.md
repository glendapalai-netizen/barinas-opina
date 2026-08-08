# BARINAS OPINA

Consulta al sector turismo del estado Barinas sobre la carga tributaria y el
estado de los servicios públicos, para la **Cámara de Desarrollo Turístico del
Estado Barinas (CADTEBA)**.

En vivo: **https://barinas-opina.netlify.app**
Informe (privado): **https://barinas-opina.netlify.app/informe/**

Hecho por **BHG Estudio** · Glenda «Cle» Palai · agosto de 2026.

---

## Por qué existe

En abril de 2026 se instaló el **Consejo Nacional de Economía Productiva** con
el mandato de diseñar un nuevo modelo tributario. En julio, Fedecámaras,
Consecomercio y Conindustria llevaron sus propuestas al SENIAT.

El turismo del interior no estaba en esa mesa, y no tenía números propios que
poner. Esta aplicación es cómo CADTEBA los levanta: negocio por negocio,
municipio por municipio, para llegar con datos y no con una queja.

En paralelo, el gremio nacional pidió a las cámaras regionales un diagnóstico
de servicios públicos. Las dos consultas viven aquí, en un solo recorrido, para
que el prestador responda una sola vez.

## El argumento que sostiene todo

Barinas concentra su afluencia turística en **cuatro momentos del año**
—Carnaval, Semana Santa, vacaciones escolares y diciembre— que **no suman
sesenta días**, y aun en ellos la ocupación promedio no pasa del **25 % al 30 %**.
La obligación tributaria, en cambio, corre los doce meses sobre el ingreso
bruto.

Menos de un tercio de capacidad, durante menos de un sexto del año, tributando
el año entero. Eso es lo que ningún promedio nacional alcanza a ver, y es lo que
esta consulta mide.

---

## Cómo está hecho

Sin framework y sin compilación: HTML, CSS y JavaScript a mano, más funciones
de Netlify y Netlify Blobs como almacén. Se despliega subiendo la carpeta.

```
index.html                    la consulta (una sola página, doce pantallas)
preview.html                  plantilla de la imagen que sale en WhatsApp
fondo/ventana.mp4 · .jpg      el atardecer de la portada, y su foto de respaldo
preview.jpg                   la imagen ya generada (1200×630)
icono.png                     ícono del sitio
marcas/                       CADTEBA · Turismo somos todos · Más que llano
informe/index.html            el informe, con su puerta de acceso
netlify/functions/
  opina.mjs                   guarda respuestas · sirve el informe y el CSV
  acceso.mjs                  usuarios, claves y pases firmados
netlify.toml                  dónde viven las funciones
```

### La consulta

Doce pantallas, una pregunta a la vez, casi todo es tocar. El modelo es el de
**Pol.is / vTaiwan**: cuanta menos fricción, más gente responde. Por eso **no
pide iniciar sesión ni identificarse** para opinar — los datos de contacto van
al final y el nombre del negocio es lo único obligatorio.

El recorrido:

| Pantalla | Qué recoge |
|---|---|
| `portada` | por qué se está preguntando |
| `negocio` `rubro` `municipio` `tamano` | quién responde |
| `temporada` | momentos del año, días con afluencia real, ocupación |
| `impuestos` | cuáles aprietan más (hasta tres) |
| `cambios` | qué haría falta |
| `uno` | si pudiera cambiar uno solo, y por qué |
| `inversion` | qué lo haría invertir o contratar |
| `servicios` | los seis servicios, con las cuatro notas del diagnóstico nacional |
| `servicios-general` | calidad general y prioridad a atender |
| `acuerdos` | deslizador de consenso: de acuerdo · paso · en desacuerdo |
| `contacto` | nombre, WhatsApp, correo, afiliación |
| `cierre` | gracias, contador y botón para compartir |

**Las pantallas se identifican por nombre (`data-id`), no por número.** Al
principio iban numeradas y cada pregunta nueva rompía la navegación. Si mañana
hay que insertar otra, se pega la sección y se agrega su caso en `listo()`;
nada más.

### El informe

Se arma solo con lo que va entrando. Tiene, en orden:

1. **La temporada** — de primero, porque enmarca todo. Incluye un recuadro con
   la frase lista para leer en voz alta, calculada por el **piso** de cada rango
   para que la cifra quede corta y no larga: un informe que exagera se cae con
   una sola pregunta.
2. Tributos que más aprietan · la prioridad número uno · qué hace falta · qué
   los haría invertir.
3. **Consenso** — cada frase con su tira verde/gris/coral y etiqueta automática:
   sobre 75 % «el gremio está unido», entre 40 % y 60 % «está partido», bajo 35 %
   «lo rechaza».
4. **Servicios** — cada uno con su porcentaje de «deficiente o crítico», y una
   tabla de **peor servicio por municipio**. Marca los municipios con una sola
   respuesta, para no sacar conclusión de aire.
5. Citas textuales, perfil de quienes respondieron, y la base completa con
   descarga en CSV e impresión a PDF.

### El acceso al informe

Sin correo y sin Google: usuario y clave propia por persona.

- Las claves **no se guardan**: solo su huella (PBKDF2-SHA256, 210 000 vueltas,
  sal distinta para cada quien).
- La primera entrada es con la clave de estreno `12345` y **obliga a cambiarla**
  antes de dejar ver nada.
- Al entrar se emite un **pase firmado (HMAC-SHA256) que vence a las 12 horas**
  y vive solo en la pestaña. No es una llave permanente.
- Ocho intentos fallidos y la cuenta se traba.
- Un usuario inexistente responde igual que una clave mala, para no delatar qué
  usuarios hay.
- Las comparaciones son en tiempo constante.

**No hay «olvidé mi clave».** Sin correo no hay a dónde mandar un enlace de
recuperación. Si se pierde, hay que borrar `u/<usuario>` del almacén de Blobs y
la persona vuelve a estrenar con `12345`.

Para agregar a alguien: se añade a `GENTE` en `netlify/functions/acceso.mjs` y
en el siguiente despliegue aparece con su clave de estreno.

---

## Variables de entorno

| Nombre | Para qué |
|---|---|
| `SECRETO_ACCESO` | firma de los pases. **Configúrala en Netlify.** Mientras no exista, el código usa un valor de respaldo que está a la vista en este repositorio — sirve para arrancar, no para quedarse. |

## Desplegar

Desde esta carpeta:

```
npx -y @netlify/mcp@latest --site-id <SITE_ID> --proxy-path "<url que da el MCP de Netlify>"
```

El despliegue manual **reemplaza el sitio completo**, así que hay que subir
siempre la carpeta entera y no archivos sueltos.

Para regenerar `preview.jpg` después de cambiarle el texto a `preview.html`:
se sirve la carpeta en local y se le toma una captura de 1200×630.

## La API

| | |
|---|---|
| `POST /api/opina` | guarda una respuesta. Devuelve `{ok, total}`. Abierto: así tiene que ser. |
| `GET /api/opina` | el informe en JSON. Exige pase. |
| `GET /api/opina?csv=1&pase=…` | la base en CSV, con BOM para que Excel abra bien los acentos. El pase va por la dirección porque la descarga la dispara el navegador y no lleva cabeceras. |
| `POST /api/acceso` | `{usuario, clave}` para entrar · `{usuario, clave, nueva}` para cambiarla. |

Todo se guarda en el almacén de Blobs **`consulta-barinas`**: las respuestas bajo
`r/<fecha>-<azar>` y los usuarios bajo `u/<usuario>`. Cada respuesta va en su
propia llave y el contador se recalcula, nunca se asume — guardar es barato, lo
caro sería perder una respuesta.

---

## El marco legal, verificado

Todo esto está citado dentro de la aplicación, en «¿Cuáles son las reglas hoy?».
Las fechas se confirmaron una por una; **no se cite nada de aquí sin verificar**.

- **Ley Orgánica de Turismo** — Decreto 1.441, Gaceta Oficial 6.152
  Extraordinario del 18-11-2014. **Artículo 53**: contribución especial del **1 %**
  sobre ingresos brutos mensuales al INATUR. Contempla exenciones de IVA para
  turismo receptivo, de escasa aplicación práctica.
- **LOCAPTEM** — Ley Orgánica de Coordinación y Armonización de las Potestades
  Tributarias de Estados y Municipios, promulgada el **11-08-2023**.
- **Ley de Protección de las Pensiones** — G.O. 6.806 Extraordinario del
  08-05-2024. El aporte del **9 %** sobre nómina lo fijó el Decreto 4.952, G.O.
  42.880 del 16-05-2024.
- **Aseo urbano en el municipio Barinas** — lo cobra la **Empresa Ecológica para
  el Desarrollo Barinés (Ecodeba, S.A.)**, adscrita a la Alcaldía del Municipio
  Barinas. El reclamo del gremio: se cobra por metro cuadrado y no por desecho
  generado.
- **Consejo Nacional de Economía Productiva** — instalado el **08-04-2026** con
  el mandato de diseñar un nuevo modelo tributario.
- **Reunión con el SENIAT, 21-07-2026** — Fedecámaras, Consecomercio y
  Conindustria plantearon: IVA de 15 a 30 días, retenciones del 75 % al 50 % o
  25 %, suprimir el IGTF, evitar la sobreposición de tributos municipales,
  digitalizar y armonizar criterios.
- El gremio turístico nacional estimó en mayo de 2026 que el sector entrega
  **más del 50 %** de sus ingresos brutos entre tributos nacionales, estadales y
  municipales.

**No hay un proyecto de ley de reforma fiscal del turismo introducido.** Lo que
hay es la mesa donde se está armando. Decirlo de otra forma sería faltar a la
verdad.

---

## La portada

Video a pantalla completa —una ventana al atardecer sobre la sabana— con el
título, los sellos y el texto sobre cristal. Vive **solo en la portada**: al
tocar «Comenzar» el video se detiene y vuelve el crema. Un video corriendo
detrás de las preguntas cansa la vista, gasta batería y distrae de lo único
que importa, que es que la persona conteste.

La foto va como `<img>` y **se pinta siempre**; el video se funde encima solo
cuando de verdad logra reproducirse. Si el teléfono no puede con él, si el dato
se cae o si el ahorro de datos está puesto, queda la foto y nadie se entera de
que faltó algo. El video no se descarga hasta que hace falta.

## El vidrio

Dos vidrios distintos, porque el fondo manda:

`.vidrio` — sobre el video: translúcido de verdad, con desenfoque del fondo y
un filo de luz arriba y abajo, como el canto de un cristal.

`.vidrio-mate` y las tarjetas — sobre el crema no hay nada que refractar detrás,
así que el volumen se hace con luz y sombra y no con transparencia. Un cristal
translúcido sobre un plano liso se ve sucio, no elegante.

Las letras de BARINAS OPINA no llevan una imagen: el bisel es un degradado
recortado sobre el texto (claro arriba, apagado al centro, encendido abajo) y
el grosor son cuatro sombras superpuestas — canto, corte, cuerpo y apoyo.

## Decisiones que conviene no deshacer

**La consulta no pide iniciar sesión.** Cada paso adelante cuesta respuestas, y
se le está pidiendo a un prestador de un municipio del interior que opine sobre
impuestos. El anonimato hace que hable más claro. Sesenta respuestas honestas
valen más que quince firmadas.

**El pase se verifica en el servidor.** Si la verificación se hiciera en el
navegador, se saltaría en dos minutos y sería peor que una clave compartida.

**Las cifras se calculan por el piso del rango.** Siempre del lado conservador.

**Los municipios con una sola respuesta se marcan.** El informe dice lo que
sabe y no finge saber más.

**El logotipo va en versales**: BARINAS OPINA, azul y naranja, como las letras
de las marcas.

---

## Paleta

Sale de las tres marcas: el crema y los planos de «Más que llano», los tonos
pintados de «Turismo somos todos», y el oro de CADTEBA. Cada pantalla toma un
color distinto, igual que cada letra de los logos toma el suyo.

| | |
|---|---|
| crema | `#FBF3DE` |
| naranja | `#F5900A` |
| azul | `#0C34D6` |
| coral | `#F0472E` |
| verde | `#2E8F14` |
| turquesa | `#00A0AE` |
| magenta | `#C4187C` |
| oro CADTEBA | `#B8862F` |

---

## Lo que falta

- [ ] Dominio propio: `opina.cadteba.org` (Wix) o `opina.cadteba.info` (Squarespace)
- [ ] Configurar `SECRETO_ACCESO` en Netlify
- [ ] Borrar las respuestas de prueba antes de repartir el enlace
- [ ] Asistente de Gemini dentro de la consulta, para explicar los tributos y las
      leyes mientras se responde. Sin dar asesoría tributaria: explica y remite.
- [ ] Enlace y código QR en la lámina de una página
