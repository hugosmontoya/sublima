# SUBLIMA

> *La paradoja sensorial del hielo seco*

**SUBLIMA** es una plataforma web interactiva que traduce el acto de tocar hielo seco (dióxido de carbono sólido a −78.5 °C) en imagen y sonido en tiempo real. Un teléfono móvil (iOS o Android, sin instalar apps) actúa como control remoto táctil y envía datos mediante **MQTT** a una experiencia audiovisual en el computador.

---

## 1. Concepto

Tocar hielo seco encierra una triple contradicción física y táctil:
1. **Quema sin quemar (Quemadura por congelación):** El frío extremo activa los mismos receptores nociceptivos del dolor térmico que una llama ardiente.
2. **Resbala sin fricción (Efecto Leidenfrost criogénico):** Al entrar en contacto con el calor de la piel, el CO₂ sublima instantáneamente a gas, creando una película de vapor que hace levitar el dedo y anula la fricción mecánica.
3. **Chirrido al aprisionarlo:** Al presionar o atrapar un trozo de hielo seco, el gas que intenta escapar vibra a frecuencias audibles agudas y disonantes, produciendo un quejido estridente característico.

SUBLIMA explora esta relación trasladando cada gesto de la mano a una propiedad visual y sonora del bloque de hielo seco.

---

## 2. Funcionamiento y Conexiones

### La Imagen del Bloque de Hielo Seco

El escenario central muestra una imagen de alta resolución de un **bloque rectangular de hielo seco sólido (CO₂ a −78.5 °C)** con escarcha cristalina y vetas translúcidas. La imagen reacciona en tiempo real a las distintas formas de tocarlo:
- **Cráter de sublimación:** Donde se apoya el dedo, la superficie del hielo se adelgaza y desgasta con un resplandor térmico de gas desprendido.
- **Microtemblor de impacto (Tap):** Al golpear el bloque, la imagen tiembla elásticamente con una sacudida percusiva.
- **Estela Leidenfrost:** Al deslizar el dedo a gran velocidad, deja un surco brillante de gas flotante sobre la superficie rocosa del hielo.
- **Tensión de apresamiento (Pinch):** Al juntar dos dedos, la textura del hielo entre ellos se comprime y se tiñe de un halo violeta oscuro de gas atrapado.
- **Fractura de masa:** Si aumenta la presión, se disparan grietas vectoriales que penetran y agrietan el cuerpo del bloque.

---

### Tabla de las 8 Conexiones (Gesto → Imagen → Sonido)

| # | Gesto del Teléfono | Canal MQTT | Transformación en la Imagen | Cualidad del Sonido (Web Audio API) |
|---|---|---|---|---|
| **1** | **Contacto y posición (X, Y)** | `touch.x`, `touch.y`, `touch.down` | Partículas de CO₂ emergen del bloque y suben disipándose; cráter térmico bajo el dedo | **Siseo de vapor basal:** Ruido blanco continuo con filtro bandpass modulado en frecuencia por la posición espacial (1800–4000 Hz). |
| **2** | **Presión / Aprisionamiento** | `touch.f`, `touch.d` | Halo incandescente criogénico (núcleo blanco, corona cian y violeta); grietas en el hielo | **Chirrido FM estridente:** Síntesis FM inestable (portadora 950–3750 Hz + moduladora con jitter y pico resonante a 2900 Hz). |
| **3** | **Apresar con dos dedos (Pinch cerrar)** | `touch.dist` < 0.45 | El vapor se comprime hacia el centro entre ambos dedos; zona oscura de condensación | **Retumbo subgrave:** Oscilador de 42–117 Hz con distorsión no-lineal (tanh) y filtro lowpass que simula gas atrapado en bolsa a alta presión. |
| **4** | **Deslizamiento veloz (Fricción cero)** | `touch.vx`, `touch.vy` (velocidad) | Estela brillante horizontal de gas sobre la superficie del hielo (cojín Leidenfrost) | **Silbido Leidenfrost:** Oscilador agudo (2800–4400 Hz) con trémolo rápido de levitación (18 Hz) al resbalar sin fricción. |
| **5** | **Tap / Golpe percusivo inicial** | Transitorio de `touch.down` | Sacudida elástica (shake) del bloque de hielo seco y onda de choque en el punto de contacto | **Microfractura cristalina:** Transitorio impulsivo percusivo con caída exponencial rápida y resonador metálico helado a 3200 Hz. |
| **6** | **Apertura brusca (Pinch abrir)** | Delta positiva rápida en `touch.dist` | Explosión expansiva de partículas de vapor en abanico que cubren el bloque | **Ráfaga de despresurización:** Descarga explosiva de gas a alta velocidad (ráfaga de ruido filtrado de 1400 a 4500 Hz). |
| **7** | **Múltiples dedos (3 a 5 dedos)** | `touch.n` ≥ 3 | Acumulación de múltiples cráteres de escarcha cristalina bajo cada dedo | **Crepitar de escarcha:** Generador estocástico de micro-clicks de tensión térmica (salpicaduras y microfracturas de cristales). |
| **8** | **Presión sostenida alta** | `touch.f` > 0.4 | Árbol fractal de grietas heladas con bifurcaciones vectoriales sobre el bloque | **Modulación de quemadura:** El siseo y el chirrido entran en saturación armónica al alcanzar el límite de tolerancia de frío. |

---

### Declaración de Sonidos y Autoría

- **Motor de audio:** Síntesis procedural en tiempo real programada directamente mediante **Web Audio API** (`public/audio.js`).
- **Archivos de audio externos:** Ninguno. Todos los sonidos (siseo, chirrido FM, retumbo subgrave, silbido Leidenfrost, microfracturas percusivas, ráfagas de gas y crepitar estocástico) son generados por código algorítmico original en tiempo real, garantizando **latencia cero, respuesta continua a los sensores y licencia 100% libre / de autoría propia**.

---

## 3. Arquitectura del Proyecto

```
sublima/
├── .github/workflows/pages.yml   Workflow de publicación en GitHub Pages
├── server.js                     Servidor Node.js (Express + broker MQTT Aedes embebido)
├── package.json                  Dependencias del servidor local
├── README.md                     Documentación académica y técnica
└── public/
    ├── index.html                Control remoto táctil para el teléfono
    ├── exp.html                  Experiencia audiovisual del computador
    ├── exp.js                    Orquestador del loop interactivo (sensores → lienzo → sonido)
    ├── audio.js                  Motor sonoro procedural criogénico (8 capas de audio)
    ├── particulas.js             Física de partículas de vapor CO₂ y ráfagas expansivas
    ├── grietas.js                Generador fractal de fracturas heladas sobre el hielo
    ├── tacto.js                  Librería de conexión MQTT y canales normalizados
    ├── hielo_seco.png            Imagen de textura de alta resolución del bloque de hielo seco
    ├── ui.css                    Sistema de diseño criogénico e industrial (#03070D, #64FFDA, #7B2CBF)
    ├── config.js                 Configuración de broker MQTT en la nube (EMQX)
    └── vendor/
        └── mqtt.min.js           Cliente MQTT para funcionar de forma autónoma
```

---

## 4. Reflexión Crítica

### ¿Qué descubrí al traducir el tacto en imagen y sonido?
Al explorar la paradoja del hielo seco quedó en evidencia que **el tacto no es un sentido unidimensional de presión**: es una combinación de temperatura, fricción, resistencia elástica y escape de fluidos. 
Si solo hubiésemos usado la presión para modular el volumen, la experiencia se sentiría como un control de volumen genérico. La clave estuvo en identificar los comportamientos físicos reales del CO₂:
- El **deslizamiento sin fricción** (Leidenfrost) se traduce mejor mediante la velocidad de arrastre (`touch.vx, vy`) acoplada a un silbido aéreo.
- El **chirrido** solo tiene sentido cuando se aprisiona el gas, por lo que el gesto de **pinch** (apresar entre dos dedos) cobra un significado físico mucho más potente que girar el teléfono en el aire.
- El contraste entre el retumbo sordo del gas comprimido y el chillido agudo de la descompresión reproduce la tensión térmica del hielo seco.

### ¿Qué queda fuera de este sistema?
1. **La temperatura háptica real:** La sensación física del frío adormecedor en la piel no puede transmitirse directamente a través del vidrio templado del smartphone. Dependemos de la sinestesia auditiva y visual para evocarla.
2. **La sublimación de volumen permanente:** El bloque real de hielo seco va perdiendo masa física hasta desaparecer en el aire. En nuestra versión actual, el bloque se regenera y los cráteres se desvanecen; no hay un desgaste geológico irreversible en el tiempo.

### Dos mejoras concretas
1. **Malla WebGL de deformación topológica de masa:** Sustituir el lienzo 2D por una malla deformable con heightmap tridimensional donde el calor del dedo derrita y ahueque permanentemente el bloque tridimensional de hielo seco.
2. **Síntesis granular orientada a granos de hielo:** Implementar un motor de síntesis granular con ventanas de 5 a 20 ms sobre muestras de cristales de hielo para enriquecer aún más la textura del chirrido mecánico.

---

## 5. Puesta en Marcha

### En GitHub Pages (Sin instalar nada en la máquina)
1. Publica el repositorio en GitHub Pages desde **Settings → Pages → Source: GitHub Actions**.
2. Abre la experiencia en el computador: `https://<tu-usuario>.github.io/sublima/exp.html`
3. Abre el control en el teléfono: `https://<tu-usuario>.github.io/sublima/`
4. Ingresa el código de sala que muestra la pantalla del computador y pulsa **Conectar**.

### En Servidor Local (Node.js)
```bash
cd sublima
npm install
node server.js
```
Abre en el computador `https://localhost:8443/exp` y en el teléfono la IP indicada en la consola.
