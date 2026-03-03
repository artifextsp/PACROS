# 🍩 Media Rosquilla — Pac-Man Caleño Multijugador

Juego web multijugador de Pac-Man temático de rosquillas caleñas. Dos jugadores desconocidos se emparejan aleatoriamente y controlan juntos a Pac-Man para comer rosquillas y esquivar fantasmas.

## 🎮 Características

- **Multijugador cooperativo** en tiempo real vía Firebase
- **Matchmaking automático** — empareja jugadores aleatorios
- **Chat integrado** entre jugadores
- **5 niveles** de dificultad progresiva
- **Sistema de premios** por puntaje alcanzado
- **Leaderboard global** de mejores parejas
- **Modo IA** si no hay compañero disponible
- **Controles táctiles** (D-pad) para móvil
- **Totalmente responsive** — funciona desde 320px hasta desktop

## 🚀 Configuración de Firebase

### 1. Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Click en **"Agregar proyecto"**
3. Nombre del proyecto: `media-rosquilla` (o el que quieras)
4. Desactiva Google Analytics (no es necesario)
5. Click en **"Crear proyecto"**

### 2. Activar Realtime Database

1. En el panel lateral, ve a **Build → Realtime Database**
2. Click en **"Crear base de datos"**
3. Selecciona la ubicación más cercana
4. Selecciona **"Comenzar en modo de prueba"** (para desarrollo)
5. Click en **"Habilitar"**

### 3. Configurar reglas de seguridad

En la pestaña **"Reglas"** de Realtime Database, usa estas reglas para desarrollo:

```json
{
  "rules": {
    "waiting": {
      ".read": true,
      ".write": true
    },
    "rooms": {
      ".read": true,
      ".write": true
    },
    "leaderboard": {
      ".read": true,
      ".write": true
    }
  }
}
```

> ⚠️ Para producción, deberías agregar validaciones más estrictas.

### 4. Obtener la configuración del proyecto

1. En la consola de Firebase, ve a **Configuración del proyecto** (ícono de engranaje)
2. En la sección **"Tus apps"**, click en **"Agregar app"** → **Web** (ícono `</>`)
3. Nombre: `media-rosquilla-web`
4. **No** marques Firebase Hosting
5. Click en **"Registrar app"**
6. Copia el objeto `firebaseConfig`

### 5. Agregar la configuración al proyecto

Abre el archivo `network.js` y reemplaza el objeto `FIREBASE_CONFIG` con tus valores:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "AIzaSy...",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

## 📁 Estructura de archivos

```
PACROS/
├── index.html      → Estructura HTML con todas las pantallas
├── style.css       → Estilos visuales, tema caleño, responsive
├── game.js         → Motor del juego (Canvas API, laberinto, fantasmas)
├── network.js      → Firebase: matchmaking, sync, leaderboard
├── chat.js         → Sistema de chat en tiempo real
├── main.js         → Orquestador principal (conecta todo)
└── README.md       → Este archivo
```

## 🌐 Despliegue en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube todos los archivos del proyecto
3. Ve a **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` / `root`
6. Click en **Save**
7. Tu juego estará disponible en `https://tu-usuario.github.io/tu-repo/`

## 🎯 Sistema de premios

| Puntaje       | Premio                                    |
|---------------|-------------------------------------------|
| 1,000+        | 🍩 Pack de rosquillas caleñas            |
| 3,000+        | 🎬 Entradas al cine + combo              |
| 5,000+        | 🗺️ Tour gastronómico por Cali            |
| 10,000+       | 👑 Media Rosquilla VIP                    |

## 🕹️ Controles

- **Desktop:** Flechas del teclado o WASD
- **Móvil:** Botones táctiles D-pad en pantalla

## 🏗️ Tecnologías

- HTML5 Canvas API
- CSS3 con diseño responsive
- JavaScript vanilla (sin frameworks)
- Firebase Realtime Database (plan gratuito Spark)
- Google Fonts (Fredoka One + Nunito)

---

Hecho con 💛❤️💚 — Campaña Rosquillas Caleñas 🇨🇴
