# Instrucciones para arrancar SUBLIMA

## 1. Instalar dependencias (solo la primera vez)

Abre una terminal **CMD** o **PowerShell** normal (no la del agente) y ejecuta:

```
cd C:\Users\hugod\OneDrive\Escritorio\sublima
npm install
```

## 2. Arrancar el servidor

```
node server.js
```

Verás algo como:
```
  ╔══════════════════════════════════════════╗
  ║  S U B L I M A                           ║
  ║  La paradoja sensorial del hielo seco    ║
  ╚══════════════════════════════════════════╝
  Experiencia (computador):  https://localhost:8443/exp
  Teléfonos entran a:        https://192.168.X.X:8443
  Broker MQTT:  wss://localhost:8443/mqtt   ·   tcp :1883
```

## 3. Usar

1. Abre `https://localhost:8443/exp` en el computador
2. Acepta el aviso de certificado
3. Pulsa **▶ ACTIVAR AUDIO**
4. El teléfono escanea el QR o escribe la dirección
5. Escribe nombre y sala → **CONECTAR**
6. ¡Toca!
