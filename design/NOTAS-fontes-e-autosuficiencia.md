# Fontes, e que a web se manteña soa

O obxectivo fixado o 28 de agosto de 2026: cando estea acabada, a menos que cambie unha
ruta ou un bus, a web ten que manterse soa. Isto é o inventario do que hai, do que
falta, e —o máis importante— **onde está a raia** entre o que se pode deixar só e o que
non.

---

## A raia: que pode ir só e que non

### Pode ir só, e xa vai

| | Cada canto | Como |
|---|---|---|
| **Avisos do operador** | cada hora no calendario; catro veces ao día en outubro de 2026 | `deploy-pages.yml` corre `tools/fetchAlerts.ts` e volve despregar |
| **Itinerarios e horarios** | cada semana | `check-source.yml` corre `reconcile --fresh` e **falla** se a páxina do operador xa non di o que publicamos |

Iso cobre o obxectivo: mentres non cambie unha ruta nin un bus, ninguén ten que
tocar nada; e o día que cambien, salta.

### Pode ir só, e aínda non vai

- **As tarifas.** `buslugo.com/tarifas/` é unha táboa HTML estable e é a fonte que manda.
  Hoxe os prezos están escritos en `transitData.ts`. Deberían comprobarse no mesmo traballo
  semanal: non para cambialos sós —un prezo que muda só é un prezo no que non se pode
  confiar— senón para **fallar** cando deixen de coincidir.
  *Feito: `tools/checkFares.ts` corre cada luns en `check-source.yml` (máis abaixo, «As
  tarifas»).*
- **Os avisos do operador nunha segunda fonte.** O RSS de `urbanoslugo.com/es/rss.xml` está
  abandonado hoxe, pero é XML e custa nada consultalo. O día que o usen, chega de balde.
  *O 31 de outubro de 2026 o dominio `urbanoslugo.com` xa nin resolve; `info.urbanoslugo.com`,
  o dos QR, si.*

### **Non pode ir só**

- **As obras e avisos municipais.** Non hai fonte lexible por máquina. `datosabertos.lugo.gal`
  devolve 503 nos endpoints CKAN e 404 nos catálogos; a web do Concello é HTML pensado para
  ler, e raspala é un proxecto propio que ademais obriga a ler os seus termos. Quedan
  escritos a man, **con data de revisión e cun aviso que salta aos seis meses**. Iso é o
  máximo que se pode automatizar: que a app admita soa que ninguén mirou.
- **Os nomes das paradas e das liñas.** Veñen do scrape. Cambialos é unha decisión, non un
  refresco.
- **Calquera cousa que a app afirme sobre cartos.** Detéctase soa que cambiou; cámbiase a
  man.

---

## As fontes, unha por unha

| Fonte | Que serve | Automatizable? |
|---|---|---|
| **buslugo.com** | avisos (na barra de navegación) e as páxinas de liña | **Si**, e xa se usa |
| **buslugo.com/tarifas/** | a táboa de prezos vixente | **Si.** Semanal, `checkFares.ts` |
| **buslugo.com/normativa/** | dereitos e obrigas das persoas usuarias | Si, pero non fai falta: cambia moi de raro |
| **info.urbanoslugo.com/qr-demo-paradas/<código>** | **tempos de paso por parada** | **Si**, e é o achado gordo. Ver abaixo |
| **urbanoslugo.com** | a web da propia operadora, Monbus Urbanos S.A. | RSS abandonado; sen HTTPS |
| **datosabertos.lugo.gal** | portal de datos abertos | **Non.** 503 e 404 |
| **Folleto impreso do Concello** | tarifas, nomes de liña, planos | **Non**, é papel; vale para contrastar |

### O achado: o operador si publica tempos por parada, e **non son do horario**

`https://info.urbanoslugo.com/qr-demo-paradas/<codigo>` devolve, por parada, as vindeiras
saídas con **liña, corredor e minutos**, e refréscase soa cada 30 segundos. **Usa os mesmos
códigos de parada ca esta app**: comprobado con `uilP`, `qFuw`, `RnND`, `XpKC` e `gJRz`,
todos 200 e con datos coherentes entre paradas seguidas — a L4.2 sae a 0 min en `qFuw`,
1 min en `RnND` e 1 min en `XpKC`, que están unha detrás doutra na Ronda da Muralla.

**Son medidos, non calculados dun horario.** Seis mostras, unha por minuto, na parada
`uilP` o 28 de agosto:

```
12:46:59   L6  7 min      outra saída 14 min
12:48:25   L6  5 min      13 min
12:49:25   L6  5 min      13 min      <- párase
12:50:26   L6  4 min      11 min      <- baixa 2 min en 61 s
12:51:26   L6  4 min      10 min      <- párase
12:52:27   L6  3 min       9 min
```

Unha conta atrás feita sobre unha hora fixa baixa exactamente un minuto por minuto e non
fai outra cousa. Esta **párase e dá saltos**, o que só pode significar que o número se
recalcula contra algo que se move. Iso pese a que o propio RSS do operador aínda diga
«muy pronto info en tiempo real».

Que abre isto, por orde de importancia:

1. **Unha vara de medir.** Este proxecto enteiro distingue o publicado do calculado, e ata
   agora non había contra que comparar o erro real das nosas estimacións. Agora si.
2. Poderíanse amosar eses minutos, mais **só despois** de saber que son exactamente, que
   significa o `qr-demo-` da ruta, e se os seus termos o permiten. **Non presentalos como
   medidos ata telo por escrito**, que é a regra desta casa.

---

## O contraste co folleto do Concello

### Resolto: o transbordo

O folleto imprimía **transbordo ordinario 0,19 €** e **social 0,10 €**; a app di que son de
balde. Gaña a app: `buslugo.com/tarifas/`, consultada o 28 de agosto, di **0,00 €** nos
dous. O folleto está desactualizado nesa liña e certo nas outras tres (0,64 / 0,45 / 0,31).

### Sen resolver: os nomes de liña

O Concello nomea as liñas polo corredor, buslugo polas cabeceiras:

| | Concello | O que amosa a app |
|---|---|---|
| 1.1 | Campus Universitario – Fingoi – O Ceao | Opuesto Piscina Pedreiras – Rúa Mercadorías (Terminal) |
| 7 | Casco Histórico (Bolaño) – Barrio da Ponte | Bolaño Ribadeneira 1 – A Ponte (cruce Fl…) |

O do Concello dille a alguén por onde vai; o do operador, onde remata. Paga a pena, pero é
un cambio de datos e habería que decidir cal manda.

---


## Redes sociais e outras webs (comprobado o 28 de agosto)

Preguntouse por elas. A resposta curta é **non hai por onde**, e convén que quede
escrito para non volver mirar:

- **`@010lugo` en X** — é a conta de información do Concello e é a que interesa; enlázaa a
  propia web da operadora. Pero X pide API de pago, e Nitter morreu (410). Non é lexible.
- **`concellodelugo.gal/es/actualidad`** — 200, pero a lista de novas píntaa JavaScript: o
  HTML estático só trae o formulario de busca. Raspalo obrigaría a meter un navegador
  completo nun traballo programado.
- **`concellodelugo.gal/rss.xml`** — **si funciona**: RSS válido, 55 KB. Pero son notas de
  prensa, dez entradas entre marzo de 2025 e xuño de 2026, unha cada dous meses. Non dará
  obras. Si trouxo unha cousa directamente útil: «AUTOBUSES GRATUÍTOS PARA O ACTO DE INICIO
  DO ARDE LUCUS».

Conclusión: **paga a pena consultar o RSS do Concello** e amosar só o que fale de
transporte, etiquetado como nota de prensa do Concello e coa súa data — nunca como «obras
comprobadas automaticamente», que é o que non é. As obras seguen sen fonte automática.


## Canto nos equivocamos: a primeira medida

`tools/compareOperatorTimes.ts` pon os nosos minutos ao lado dos do operador para a mesma
parada e o mesmo instante. Oito pasadas por cinco paradas o 28 de agosto, arredor das
13:10, **82 comparacións**:

- **mediana +1 min** (positivo = esta app di máis tarde ca eles)
- **38 de 82 dentro de 2 minutos** — menos da metade
- rango de −24 a +107 min

As colas non son erro noso: o emparellamento é inxenuo, colle a primeira saída dunha liña
en cada lado e as dúas poden ser sentidos distintos. **O seguinte paso é emparellar por
sentido**, e ata facelo os extremos non se poden ler como erro de estimación.

O que si se pode ler: **a mediana é practicamente cero**, así que non hai nesgo — non
chegamos nin tarde nin cedo de forma sistemática. O que hai é ruído, e agora sábese canto.

Un exemplo que amosa por que os seus números son medidos: a liña 2 en `uilP`, ás 13:05,
eles 8 min e nós 1; ás 13:07, eles 7 e nós 0. **A diferenza mantívose en −7 exactos**
mentres os dous baixaban: un bus con sete minutos de retraso, que eles saben e nós non.

Outra confirmación, independente: as clases do seu HTML chámanse `sae-content-info-line`,
`-itinerary`, `-time`. **SAE** é, neste sector, *sistema de axuda á explotación* — o nome
que se lle dá ao sistema que sabe onde están os autobuses, non ao que imprime horarios.
E o seu `robots.txt` é `Disallow:` baleiro: permiso explícito para ler.

## A DGT: comprobada, e non serve

Miroulle a proposta. O feed DATEX II aberto de `infocar.dgt.es` **é de Cataluña, non de
España**: 280 coordenadas, todas entre as lonxitudes +0,49 e +3,21 —ao leste de Greenwich—
e o propio XML identifícase como `sct`, o Servei Català de Trànsit. **Cero incidencias en
Galicia.** O punto de acceso nacional (`nap.dgt.es`) responde, pero é un portal de rexistro,
non un endpoint.

E aínda tendo acceso: a DGT leva **estradas**. Un bus urbano párao o casco vello, a Ronda
da Muralla, unha avaría de auga ou unha procesión. Das nosas 24 liñas só un par tocan
estrada da DGT (a N-VI nas liñas 2 e 3.2).

O que de verdade importa xa chega: «Retenciones en zona Estación Tren» entrou pola campá do
operador. **É un aviso de tráfico, publicado por quen sabe a que liñas afecta.** Esa é a
canle correcta para unha app de bus, e xa se le cada hora.


## Se cambia o mapa: que se detecta e que non

Pregunta aberta: se aparece unha rotonda nova e a ruta cambia, actualízase soa?
**En parte, e convén saber en cal.**

Detéctase só, cada semana, en `reconcile --fresh`:

- a posición de cada poste contra a súa páxina de buslugo **e contra o levantamento de
  OpenStreetMap**;
- a secuencia de paradas de cada itinerario contra as páxinas do operador;
- os nomes, a orde, as liñas que serven cada parada e **os cadros horarios**.

Se a rotonda fai que a liña deixe de pasar por unha parada ou que cambien as horas, salta.

**Detéctase dende agora**: o **trazado debuxado no mapa**. Era o único que podía
envellecer en silencio — vén das relacións de ruta de OpenStreetMap, importábase a man con
`pnpm data:osm`, e se a rúa cambiaba a liña do mapa seguía co percorrido vello ata que
alguén volvese importar. Ninguén se enteraría.

`tools/checkOsmGeometry.ts` corre no mesmo traballo semanal: pregunta a Overpass o mesmo
que `data:osm`, cose as relacións coa mesma función —non unha copia— e compara a lonxitude
de cada sentido coa do trazado publicado. Tamén compara `restrictedMeters`, que é a proba
na que se apoia o aviso da cabeceira do casco histórico: se alguén etiqueta o `bus=yes` que
falta, o número cae e hai que reescribir o aviso.

**O limiar é do 0,5 %**, e non é unha suposición sobre ruído: a mesma relación sen editar
cose exactamente á mesma polilínea, así que o chan é cero e calquera cousa é unha edición
real. A marxe existe para que un mapeador movendo un bordo tres metros non faga saltar a
alarma cada luns — porque unha alarma que salta cada luns acaba ignorada o luns que
importa. Comprobado: 48 rutas de 48, deriva cero; e cunha rotonda de 300 m simulada nunha
liña, falla e sae con 1.

Se Overpass non responde non falla: que un servizo compartido estea caído non é que os
datos estean mal, e facer fallar a semana por iso ensina a todo o mundo a ignorar a semana.

## Pendente

1. **Probar nun teléfono de verdade.** Só se probou en Chromium e na emulación da auditoría.
   O chan está escrito (README, «Navegadores»): o de Vite 8, Chrome e Edge 111, Firefox 114,
   Safari e iOS 16.4, e o código protexe o que está por riba del (`AbortSignal.timeout?.`,
   `wakeLock` só se existe, `vibrate?.`, o aviso sen WebGL2). Queda media hora nun iPhone e
   outra nun Android co guión de [`PROBA-no-telefono.md`](PROBA-no-telefono.md) e a lista de
   abaixo: o xesto de atrás de cada sistema, un teclado de verdade, o bloqueo, a app
   instalada, as zonas seguras, a letra do sistema e o mapa co dedo e co GPS, co xiro con
   dous dedos e o mapa do traxecto a pantalla enteira.
2. **Un lector de pantalla de verdade, nun teléfono**, cousa do dono: o guión de
   [`PROBA-lector-de-pantalla.md`](PROBA-lector-de-pantalla.md), unha vez con VoiceOver e
   outra con TalkBack (rolda 31). `audit:browser` mide nomes, estados, orde e idioma no
   código; como os di cada lector, se le o «~» das horas estimadas e se cambia de voz nos
   avisos en castelán, só se sabe escoitando.
3. **Os buscadores**, cousa do dono. O sitio está dado de alta desde o 14 de outubro de
   2026: a propiedade `https://urbanos-lugo.github.io/` en Search Console, verificada coa
   etiqueta de `index.html`, e Bing importándoa, co sitemap de 18 URL. Mirado o 29 de
   outubro: Bing atopara as 18; en Google o sitemap seguía «Non se puido ler» desde a
   primeira lectura, co dominio dun día, e volveuse enviar. Mirar que «Páxinas» amose as 18
   e que cada idioma saia a quen busca nel. Se Bing non avanza, o seguinte é o texto estático
   ou o prerender de [`AUDITORIA-seo.md`](AUDITORIA-seo.md) (puntos 5 e 7).
4. **Ubuntu 26.04 no executor, cando o zoom caiba nel.** Os traballos piden `ubuntu-24.04`
   polo nome. En 26.04 a CI enteira e a auditoría pasan, pero o 2 de novembro de 2026 (rama
   `ubuntu-26-maplibre`, rolda 59, unha execución) os catro pasos de zoom de
   `measure:browser` bloquearon o fío 867 ms nun orzamento de 900, fronte a 612 en 24.04, e o
   resto foi entre un 14 e un 42 % máis lento: cabe con 33 ms de marxe, así que segue en
   24.04. Antes de cambiar, ver que Chrome e que GL de software trae cada imaxe; volver medir
   cando GitHub anuncie a retirada de 24.04, ou se un Chrome novo move esta medida.
5. **O pin de orixe e o da primeira subida tápanse** no mapa do traxecto cando a orixe está
   xunto á parada (visto na rolda 62). Un dos dous ten que apartarse, ou o A non debuxarse
   cando cae dentro do pin da subida.
6. **As páxinas da 1.7.6 e da 1.7.7 en GitHub (Releases)**, cousa do dono: a sesión que as
   publicou non as puido crear. O texto de cada unha é o da súa etiqueta.
7. **O worker non se volve publicar cando cambia un dicionario.** `deploy-worker.yml` sae só
   cando cambian `worker/`, `src/services`, `src/data`, `src/utils` ou `src/project.ts`, pero
   o worker le `src/i18n/translations.ts` a través de `src/utils/places.ts`. Hoxe non perde
   nada: os textos que cambiaron na 1.7.6 e na 1.7.7 son de pantalla e o worker non os usa
   (rolda 64). Engadir `src/i18n/**` aos camiños, ou deixar escrito por que non.

### Lista para o iPhone

Media hora cun iPhone real, en Safari, con iOS 16.4 ou máis. Anotar o modelo e a versión.

1. Abrir `urbanos-lugo.github.io`. O taboleiro con horas en menos de 3 s, sen
   marco branco antes do tema escuro.
2. Compartir → **Engadir á pantalla de inicio**. Abrir desde a icona: pantalla completa,
   sen barra de Safari, a icona correcta.
3. Buscar «catedral» tecleando: as filas aparecen letra a letra sen que o teclado tape o
   campo. Abrir unha parada; premer **Compartir**: sae o panel de compartir do iPhone;
   copiar desde el e pegar en Notas: ten `?parada=`. O mesmo na ficha dunha liña: `?linea=`.
4. **Mapa**: debuxa (é MapLibre, WebGL2); pinza e xiro van fluídos; os nomes das paradas
   lense; a folla de controis sobe desde abaixo e non queda tapada pola barra de inicio
   (é onde `100dvh` e as zonas seguras rompen). Xirado con dous dedos aparece o compás
   debaixo do zoom, e tocalo volve o norte arriba. «A miña localización» unha vez segue co
   norte arriba; outra vez, xira o mapa co teléfono (o que tes diante, arriba, e o botón
   cunha frecha); a terceira deixa de seguir. En Paradas, **«Buscar preto de min»**:
   Safari pregunta pola localización e polo movemento e a orientación; aceptando as dúas, o
   punto leva un abano que xira ao virar o teléfono e apunta cara a onde miras de verdade
   (comparar coa rúa), e cada número do mapa é o da súa fila. Negando a orientación, o
   punto vai só e nada máis cambia. Só un iPhone pode probar esa pregunta.
5. Xirar o teléfono a horizontal e volver: nada queda cortado.
6. **Ruta**: calcular Praza Maior → HULA; ao calcular, a pantalla vai á resposta. Premer
   **Vou nesta**: pide o GPS, e a pantalla non se apaga durante un minuto (a *wake lock*,
   iOS 16.4+; se non existe, non debe saír erro ningún).
   Despois **Ampliar o mapa** do traxecto: ocupa a pantalla; xirar con dous dedos; o xesto
   de atrás de Safari devolve a tarxeta sen saír da resposta; tocar unha parada do
   traxecto abre o seu taboleiro, e «Volver ao resultado» volve onde estaba.
7. Cambiar tema e idioma desde o menú: as cores (`oklch()`) e os textos cambian enteiros.
8. Modo avión, pechar a app, abrila de novo desde a icona: abre, o taboleiro ten horas, e
   Avisos amosa unha resposta con data (a última ou a copia gardada), non unha lista baleira.
9. **Axustes → Accesibilidade → Texto máis grande**, ao máximo: nada se solapa nin se
   corta; a barra de abaixo segue con catro destinos.
10. **VoiceOver** un minuto: as pestanas anúncianse como ligazóns co seu nome; dentro do
    menú, pasar co dedo non sae del; ao calcular unha ruta, le a resposta.

Un fallo en calquera punto é un erro de verdade e vai ao rexistro con modelo e versión.

## Feito dende que se escribiu isto

- **Os festivos de 2027** (2 de novembro de 2026, rolda 58): a resolución saíu no DOG do 26
  de outubro, e Lugo pon o 9 de febreiro e o 5 de outubro; catorce días, coma en 2026. O
  seguinte, 2028: o decreto en xuño ou xullo de 2027 e a resolución a finais de outubro, e
  «Check the sources» avisa desde novembro.
- **O traballo dos luns cando un servidor alleo non responde** (1.2.5, 6 de outubro de
  2026): sen conexión é «non responde», o trazado pregúntalle ao espello de Overpass de
  private.coffee cando o de FOSSGIS non contesta (48 de 48 rutas iguais, comprobado a man), o
  feed do Concello ten 4 s e deixa unha liña por lectura, e o worker xa non o le, porque
  desde Deno non conecta.
- **A organización de GitHub** (13 de outubro de 2026): o repositorio é
  `urbanos-lugo/urbanos-lugo.github.io`, servido na raíz de `https://urbanos-lugo.github.io/`,
  co nome e a icona propios nos buscadores, e os datos estruturados `WebSite` desde o 31 de
  outubro (rolda 52). O enderezo vello non redirixe (DECIDIDO, 13 de outubro); os pasos,
  en [`MUDANZA-organizacion.md`](MUDANZA-organizacion.md).
- **Os mapas con MapLibre** (rolda 44, 27 e 28 de outubro de 2026): os tres mapas, sen o
  ráster de reserva de antes. O da rede xira, co compás e co teléfono ao segundo toque de «A
  miña localización», e desde a rolda 61 tamén o da ruta. Sen WebGL2, un aviso e as listas.

- **O latexo de «Vou nesta» e WCAG 2.2.2** (8 de outubro de 2026, rolda 31). Era o único
  criterio A ou AA que a app non cumpría. O dono escolleu a proposta: dúas batidas cada vez
  que cambia a seguinte parada, e quieta despois (DECIDIDO). A app cumpre os 55.

- **O zoom do mapa volve estar dentro do seu orzamento no *runner*** (6 de outubro de 2026,
  rolda 28 do rexistro). Os catro pasos bloqueaban o fío 733 ms o 21 de setembro e
  1.051–1.242 desde o 28. Unha parte foi o navegador: o código do 21 bloquea 733 ms con
  Chrome 152 e 897 con Chrome 154, que é o que trouxo a imaxe do *runner*. O resto chegou
  coa fusión do 21 de setembro (`6d1199d`) e só se ve no *runner*, que pinta sen GPU e con
  catro núcleos: as capas fan exactamente o mesmo traballo en cada paso antes e despois, e
  non se buscou máis. O que si se arranxou estaba nas dúas versións: en cada cambio de
  chanzo, o efecto da selección volvía estilar un por un os marcadores que a reconstrución
  acababa de debuxar, e cada un pedía repintar o lenzo. Agora segue só á selección, e o
  *runner* mide 403 e 860 ms, fronte a 908–1.242 co mesmo Chrome e sen o arranxo.

- **O RSS do Concello** lese en cada sincronización e as notas de prensa amósanse á parte
  dos avisos do servizo, sen contar para o distintivo. Dende o 15 de setembro de 2026, só a
  etiqueta *Tráfico*, só a última semana, e só os titulares que anuncian un corte, un
  desvío ou unha restrición: auditados sesenta días de tres etiquetas, o que entraba era un
  récord de viaxeiros, unha declaración política e os cortes dunha carreira que seguirían
  en pantalla ata novembro. «Tráfico» a secas non vale como palabra —é o nome dun
  organismo tanto como unha condición da rúa—; as palabras do suceso si.
- **A instantánea de avisos vive en `public/alerts.json`**, non no paquete (19 de setembro
  de 2026, rolda 20). Importada, cada refresco horario renomeaba seis anacos —medio
  megabyte comprimido— e era a orixe das recargas por «anaco desaparecido». Como ficheiro
  á parte, un refresco move 1,3 KB. O mesmo día: o «No existen avisos en este momento» da
  campá xa non conta como incidencia, e a data dun aviso do operador di que é a da lectura.
- **Os minutos de `info.urbanoslugo.com`** amósanse só a quen chega escaneando o QR dese
  poste. É a páxina á que apunta a pegatina; en calquera outro sitio serían dúas listas de
  horas que se contradín sen que ninguén poida dicir cal manda.
- **O trazado** compárase cada semana contra Overpass, como se describe arriba.
- **As tarifas** compróbanse no mesmo traballo. `buslugo.com/tarifas` publícaas nunha
  táboa de dúas columnas, e `tools/checkFares.ts` empareja por etiqueta e non por posición
  —unha fila engadida movería unha lectura por posición ao prezo equivocado, que é o tipo
  de fallo que parece un acerto. Comprobado: os cinco prezos cadran, e cunha suba falsa de
  0,64 a 0,70 falla e sae con 1.

  **O que non cobre, e dise:** a ventá de transbordo de 75 minutos e a tarxeta TMG da
  Xunta non están nesa páxina. Afirmar que se vixía a táboa enteira cando dous terzos
  dunha tarxeta quedan fóra sería peor que non vixiar nada.
