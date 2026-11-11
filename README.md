# SUBLIMA

> *La paradoja sensorial del hielo seco*

**SUBLIMA** es una plataforma web interactiva que traduce el acto de tocar hielo seco en imagen y sonido. El teléfono actúa como superficie táctil y envía datos en tiempo real vía MQTT a una experiencia visual y sonora en el computador.

---

## 1. Concepto

Hay algunas cosas que se pueden tocar pero no se deberían tocar, el hielo seco es una de esas cosas que puede ser peligroso tocarlo con tus propias manos sin ninguna protección, este sistema te permite *oír y sentir* a través de dos pantallas como sería interactuar con este sólido tan dañino para cualquier cosa que lo toque.
Te permite interactuar con este sólido de diferentes maneras y como reacciona tanto con sonido como por el tacto a diferentes acciones.
El objetivo de este proyecto es permitir al usuario desde cierto punto como sería interactuar con este objeto a través del tacto y del oido sin sufrir las consecuencias que podrían suceder si se interactuara con este sólido en la vida real.


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


---

## 3. Reflexión

### ¿Qué descubrí al traducir el tacto?

La paradoja del hielo seco **no cabe en un canal**. La presión sola no es suficiente: este objeto si se tocase con tus propias manos ni te congela ni te quema. Aunque parece hielo que está frío no te quema ni te congela ni te moja al tocarlo.
Lo más difícil fue el sonido: el chirrido real del hielo seco es difícil de sintetizar porque es **inestable por naturaleza** — oscila entre frecuencias que no se pueden predecir. La síntesis FM con índice variable se acerca, pero le falta la granularidad del sonido real.

### ¿Qué queda fuera?

- **El frío en sí**: la temperatura no tiene análogo directo en imagen o sonido. El color azul-blanco lo evoca pero no lo comunica.
- **La sublimación visual del sólido**: las grietas en el lienzo sugieren fractura, no disolución.

### Mejoras concretas

1. **Grabación y reproducción de sesión**: grabar los mensajes MQTT y reproducirlos permitiría mostrar la experiencia sin teléfono y construir memoria del contacto.
2. **Mejor efectos visuales al interactuar con el hielo seco**: Que se vea claramente como por ejemplo se fractura el hielo seco o que hayan efectos de vapor al tocar el hielo seco.
---

