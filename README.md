# SUBLIMA

> *La paradoja sensorial del hielo seco*

**SUBLIMA** es una plataforma web interactiva que traduce el acto de tocar hielo seco en imagen y sonido. El teléfono actúa como superficie táctil y envía datos en tiempo real vía MQTT a una experiencia visual y sonora en el computador.

---

## 1. Concepto

Tocar hielo seco es contradictorio: **quema sin quemar**, **resbala sin deslizar**, **cruje sin romperse**. El CO₂ sublima directamente de sólido a gas sin pasar por líquido, creando una capa de vapor que flota entre el dedo y la superficie. El cuerpo no sabe qué sentir: el nervio del dolor y el del frío se activan a la vez.

SUBLIMA propone explorar esa paradoja a través de tres preguntas:

- **¿Qué es el vapor?** Cuando tocas, el gas emerge y sube — sistema de partículas criogénicas.
- **¿Qué es la quemadura?** Un halo incandescente blanco/cian/violeta que se expande con la presión.
- **¿Qué es el chirrido?** El sonido que hace el hielo seco al ser aprisionado — síntesis FM inestable.

La plataforma no simula el frío: **traduce la experiencia sensorial en otra experiencia sensorial**.

---

## 2. Funcionamiento

### Conexión MQTT

1. Corre `node server.js` en el computador
2. Abre `https://localhost:8443/exp` en el computador
3. El teléfono escanea el QR o escribe la dirección + código de sala
4. Pulsa **Activar audio** en la experiencia

> El teléfono y el computador deben estar en la **misma red** (hotspot del teléfono recomendado).

### Tabla de conexiones gesto → imagen → sonido

| Gesto | Canal MQTT | Imagen | Sonido |
|---|---|---|---|
| Mover 1 dedo (X, Y) | `touch.x`, `touch.y` | Partículas de CO₂ emergen del punto de toque, suben y se disipan | Siseo de vapor: filtro bandpass sigue la posición X (1800–3800 Hz) |
| Presión del toque | `touch.f` | Halo incandescente blanco/cian/violeta se expande; más grietas heladas | Chirrido FM: portadora 900–3300 Hz, índice de modulación sube con presión |
| Diámetro del contacto | `touch.d` | Radio del halo de quemadura aumenta | Contribuye al chirrido FM |
| Tocar / soltar | `touch.down` | Partículas aparecen / se disipan; grietas se congelan al soltar | Siseo se activa / silencia |
| **Pinch cerrar** (2 dedos) | `touch.dist` | Partículas se comprimen hacia el centro entre los dedos; nubes violetas | Retumbo grave crece (40–120 Hz) — gas atrapado bajo presión |
| **Pinch abrir** (2 dedos) | `touch.dist` | Campo de partículas se libera | Retumbo colapsa |

### Síntesis sonora (Web Audio API)

| Capa | Técnica | Parámetro controlado |
|---|---|---|
| **Siseo** | Ruido blanco → bandpass (1800–3800 Hz) → highpass (1200 Hz) | Frecuencia central sigue posición X; volumen sigue presión |
| **Chirrido FM** | Oscilador sierra (portadora) + moduladora sine con índice variable | Frecuencia y profundidad de modulación siguen presión |
| **Retumbo** | Oscilador sierra 40–120 Hz + distorsión + lowpass 300 Hz | Activado por pinch (`touch.dist` → fuerza de apresamiento) |

### Capas visuales

| Capa | Motor | Descripción |
|---|---|---|
| **Fondo** | Canvas 2D | Gradiente radial criogénico con scanlines y vignette |
| **Partículas** | Canvas 2D | 300 partículas CO₂ con física (velocidad, wobble, compresión por pinch) |
| **Grietas** | Canvas 2D | Árbol de segmentos con bifurcaciones, activadas por presión > 0.12 |
| **Halo** | Canvas 2D | 3 capas radiales (violeta exterior, cian medio, blanco nuclear) |

### Sonidos utilizados

Toda la síntesis es **procedural** (generada en tiempo real con Web Audio API). No se utilizan archivos de audio externos.

---

## 3. Archivos del proyecto

```
sublima/
├── server.js              Servidor Node.js (Express + broker MQTT Aedes)
├── package.json           Dependencias
└── public/
    ├── index.html         Página del teléfono (control remoto táctil)
    ├── exp.html           Estructura de la experiencia (computador)
    ├── exp.js             Lógica principal: orquesta MQTT, visual y audio
    ├── audio.js           Síntesis Web Audio API (siseo, FM, retumbo)
    ├── particulas.js      Sistema de partículas CO₂
    ├── grietas.js         Grietas vectoriales heladas
    ├── tacto.js           Librería MQTT compartida (de Tacto)
    ├── ui.css             Estilos criogénicos (fondo #03070D, cian, violeta)
    ├── config.js          Configuración de broker
    └── vendor/
        └── mqtt.min.js    Cliente MQTT local
```

---

## 4. Reflexión

### ¿Qué descubrí al traducir el tacto?

La paradoja del hielo seco **no cabe en un canal**. La presión sola no es suficiente: el chirrido ocurre cuando el gas no puede escapar — por eso el gesto de apresamiento (pinch) resultó más fiel que el giroscopio, que habría sido arbitrario.

Lo más difícil fue el sonido: el chirrido real del hielo seco es difícil de sintetizar porque es **inestable por naturaleza** — oscila entre frecuencias que no se pueden predecir. La síntesis FM con índice variable se acerca, pero le falta la granularidad del sonido real.

### ¿Qué queda fuera?

- **El frío en sí**: la temperatura no tiene análogo directo en imagen o sonido. El color azul-blanco lo evoca pero no lo comunica.
- **La sublimación visual del sólido**: las grietas en el lienzo sugieren fractura, no disolución.
- **El tiempo**: el hielo seco desaparece. Esta versión no tiene memoria — cada toque es nuevo.

### Mejoras concretas

1. **Grabación y reproducción de sesión**: grabar los mensajes MQTT y reproducirlos permitiría mostrar la experiencia sin teléfono y construir memoria del contacto.
2. **Síntesis granular para el chirrido**: reemplazar la FM por granular synthesis con granos de 10–50 ms sobre ruido filtrado lograría una textura más cercana al sonido real del hielo seco.

---

## 5. Puesta en marcha

```bash
# En el computador (Node.js 18+)
cd sublima
npm install
node server.js
```

```
Teléfono y computador deben estar en la misma red.
Se recomienda el hotspot del teléfono.
En iPhone, acepta el certificado en Mostrar detalles → visitar este sitio.
```

---

## 6. Estética

| Elemento | Valor |
|---|---|
| Fondo | `#03070D` |
| Cian (vapor) | `#64FFDA` |
| Violeta (apresamiento) | `#7B2CBF` |
| Blanco hielo | `#C8F0FF` |
| Tipografía | `Courier New`, monoespaciada |

---

*Proyecto desarrollado sobre la base de [Tacto](https://github.com/fefeliperoar/tacto) — DPPI 2026.*
