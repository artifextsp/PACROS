/* ========================================
   NETWORK.JS - Conexión Firebase
   Matchmaking, sincronización y leaderboard
   ======================================== */

// ============================================================
// CONFIGURACIÓN DE FIREBASE
// Reemplaza estos valores con los de tu proyecto Firebase
// Ver README.md para instrucciones de configuración
// ============================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBJEtv-5PDCZSy8tPW2Qdwkld8lZJvhhHA",
    authDomain: "pacros-7d411.firebaseapp.com",
    databaseURL: "https://pacros-7d411-default-rtdb.firebaseio.com",
    projectId: "pacros-7d411",
    storageBucket: "pacros-7d411.firebasestorage.app",
    messagingSenderId: "480522608386",
    appId: "1:480522608386:web:558e3be9ed697585d3ec1b"
};

class NetworkManager {
    constructor() {
        this.db = null;
        this.playerId = this._generarId();
        this.playerName = '';
        this.roomId = null;
        this.isHost = false;
        this.partnerId = null;
        this.partnerName = '';
        this.callbacks = {};
        this.waitingRef = null;
        this.roomRef = null;
        this._listeners = [];
        this._disconnectRefs = [];
    }

    // Inicializar Firebase
    init() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            this.db = firebase.database();
            console.log('Firebase inicializado correctamente');
            return true;
        } catch (error) {
            console.error('Error al inicializar Firebase:', error);
            return false;
        }
    }

    // Generar ID único para el jugador
    _generarId() {
        return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    // Generar código de sala
    _generarRoomId() {
        return 'room_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    }

    // Registrar callback para eventos
    on(evento, callback) {
        this.callbacks[evento] = callback;
    }

    // Emitir evento
    _emit(evento, datos) {
        if (this.callbacks[evento]) {
            this.callbacks[evento](datos);
        }
    }

    // ==================== MATCHMAKING ====================

    // Entrar a la cola de espera para encontrar pareja
    async buscarPareja(nombre) {
        this.playerName = nombre;

        try {
            // Buscar si hay alguien esperando
            const snapshot = await this.db.ref('waiting').orderByChild('timestamp').limitToFirst(1).once('value');
            let found = false;

            snapshot.forEach((child) => {
                const waitingPlayer = child.val();
                if (waitingPlayer.playerId !== this.playerId) {
                    // Encontramos a alguien esperando → unirse a su sala
                    found = true;
                    this.partnerId = waitingPlayer.playerId;
                    this.partnerName = waitingPlayer.name;
                    this.roomId = waitingPlayer.roomId;
                    this.isHost = false;

                    // Eliminar de la cola de espera
                    child.ref.remove();

                    // Unirse a la sala como jugador 2
                    this._unirseASala();
                }
            });

            if (!found) {
                // No hay nadie esperando → crear sala y esperar
                this.roomId = this._generarRoomId();
                this.isHost = true;
                this._esperarEnCola();
            }
        } catch (error) {
            console.error('Error en matchmaking:', error);
            this._emit('error', { message: 'Error buscando pareja' });
        }
    }

    // Ponerse en la cola de espera
    _esperarEnCola() {
        const waitingData = {
            playerId: this.playerId,
            name: this.playerName,
            roomId: this.roomId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        this.waitingRef = this.db.ref('waiting/' + this.playerId);
        this.waitingRef.set(waitingData);

        // Limpiar si se desconecta mientras espera
        this.waitingRef.onDisconnect().remove();

        // Crear la sala vacía
        this.roomRef = this.db.ref('rooms/' + this.roomId);
        this.roomRef.set({
            host: {
                id: this.playerId,
                name: this.playerName
            },
            guest: null,
            state: 'waiting',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        this.roomRef.onDisconnect().remove();

        // Escuchar cuando alguien se une
        const guestRef = this.roomRef.child('guest');
        guestRef.on('value', (snap) => {
            const guest = snap.val();
            if (guest && guest.id) {
                this.partnerId = guest.id;
                this.partnerName = guest.name;
                // Remover de la cola de espera
                if (this.waitingRef) {
                    this.waitingRef.remove();
                    this.waitingRef = null;
                }
                this._emit('parejaEncontrada', {
                    partnerName: this.partnerName,
                    isHost: this.isHost
                });
                this._configurarListenersDeSala();
            }
        });
        this._listeners.push({ ref: guestRef, event: 'value' });
    }

    // Unirse a una sala existente como jugador 2
    _unirseASala() {
        this.roomRef = this.db.ref('rooms/' + this.roomId);

        this.roomRef.child('guest').set({
            id: this.playerId,
            name: this.playerName
        });

        this._emit('parejaEncontrada', {
            partnerName: this.partnerName,
            isHost: this.isHost
        });

        this._configurarListenersDeSala();
    }

    // Configurar listeners de la sala para sincronización
    _configurarListenersDeSala() {
        if (!this.roomRef) return;

        // Manejar desconexión del compañero
        const partnerPath = this.isHost ? 'guest' : 'host';
        const partnerRef = this.roomRef.child(partnerPath);

        partnerRef.on('value', (snap) => {
            if (!snap.val() && this.partnerId) {
                this._emit('companeroDesconectado', {});
            }
        });
        this._listeners.push({ ref: partnerRef, event: 'value' });

        // Escuchar inputs del compañero
        const inputRef = this.roomRef.child('inputs/' + (this.isHost ? 'guest' : 'host'));
        inputRef.on('value', (snap) => {
            const input = snap.val();
            if (input) {
                this._emit('inputRecibido', input);
            }
        });
        this._listeners.push({ ref: inputRef, event: 'value' });

        // Escuchar estado del juego (solo el guest recibe del host)
        if (!this.isHost) {
            const stateRef = this.roomRef.child('gameState');
            stateRef.on('value', (snap) => {
                const state = snap.val();
                if (state) {
                    this._emit('estadoJuego', state);
                }
            });
            this._listeners.push({ ref: stateRef, event: 'value' });
        }

        // Escuchar señal de inicio de juego
        const startRef = this.roomRef.child('gameStarted');
        startRef.on('value', (snap) => {
            if (snap.val() === true) {
                this._emit('juegoIniciado', {});
            }
        });
        this._listeners.push({ ref: startRef, event: 'value' });

        // Escuchar reinicio
        const restartRef = this.roomRef.child('restart');
        restartRef.on('value', (snap) => {
            const val = snap.val();
            if (val && val.requested) {
                this._emit('reinicioSolicitado', val);
            }
        });
        this._listeners.push({ ref: restartRef, event: 'value' });

        // Manejar desconexión propia
        const myPath = this.isHost ? 'host' : 'guest';
        this.roomRef.child(myPath).onDisconnect().remove();
        this._disconnectRefs.push(this.roomRef.child(myPath));
    }

    // Cancelar búsqueda de pareja
    cancelarBusqueda() {
        if (this.waitingRef) {
            this.waitingRef.remove();
            this.waitingRef = null;
        }
        if (this.roomRef && !this.partnerId) {
            this.roomRef.remove();
            this.roomRef = null;
        }
        this.roomId = null;
        this.partnerId = null;
    }

    // ==================== SINCRONIZACIÓN DEL JUEGO ====================

    // Enviar input de dirección
    enviarInput(direccion) {
        if (!this.roomRef) return;
        const path = this.isHost ? 'host' : 'guest';
        this.roomRef.child('inputs/' + path).set({
            dir: direccion,
            t: Date.now()
        });
    }

    // Enviar estado del juego (solo el host hace esto)
    enviarEstadoJuego(estado) {
        if (!this.roomRef || !this.isHost) return;
        this.roomRef.child('gameState').set(estado);
    }

    // Señalar inicio de juego
    iniciarJuego() {
        if (!this.roomRef) return;
        this.roomRef.child('gameStarted').set(true);
    }

    // Solicitar reinicio
    solicitarReinicio() {
        if (!this.roomRef) return;
        this.roomRef.child('restart').set({
            requested: true,
            by: this.playerId,
            t: Date.now()
        });
    }

    // Aceptar reinicio y limpiar estado
    aceptarReinicio() {
        if (!this.roomRef) return;
        this.roomRef.child('restart').remove();
        this.roomRef.child('gameStarted').set(false);
        this.roomRef.child('gameState').remove();
        this.roomRef.child('inputs').remove();
    }

    // ==================== CHAT ====================

    // Enviar mensaje de chat
    enviarMensaje(texto) {
        if (!this.roomRef) return;
        this.roomRef.child('chat').push({
            sender: this.playerId,
            name: this.playerName,
            text: texto,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // Escuchar mensajes de chat
    escucharChat(callback) {
        if (!this.roomRef) return;
        const chatRef = this.roomRef.child('chat');
        chatRef.on('child_added', (snap) => {
            const msg = snap.val();
            callback({
                ...msg,
                isMine: msg.sender === this.playerId
            });
        });
        this._listeners.push({ ref: chatRef, event: 'child_added' });
    }

    // ==================== LEADERBOARD ====================

    // Guardar puntaje en el leaderboard
    async guardarPuntaje(puntaje, nivel) {
        try {
            const entry = {
                player1: this.isHost ? this.playerName : this.partnerName,
                player2: this.isHost ? this.partnerName : this.playerName,
                score: puntaje,
                level: nivel,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            await this.db.ref('leaderboard').push(entry);
        } catch (error) {
            console.error('Error guardando puntaje:', error);
        }
    }

    // Obtener top 10 del leaderboard
    async obtenerLeaderboard() {
        try {
            const snap = await this.db.ref('leaderboard')
                .orderByChild('score')
                .limitToLast(10)
                .once('value');

            const entries = [];
            snap.forEach((child) => {
                entries.push(child.val());
            });

            // Ordenar de mayor a menor
            entries.sort((a, b) => b.score - a.score);
            return entries;
        } catch (error) {
            console.error('Error obteniendo leaderboard:', error);
            return [];
        }
    }

    // ==================== LIMPIEZA ====================

    // Limpiar todos los listeners y desconectar
    desconectar() {
        this._listeners.forEach(({ ref, event }) => {
            ref.off(event);
        });
        this._listeners = [];

        if (this.waitingRef) {
            this.waitingRef.remove();
            this.waitingRef = null;
        }

        this._disconnectRefs.forEach((ref) => {
            ref.cancel();
        });
        this._disconnectRefs = [];

        this.roomId = null;
        this.partnerId = null;
        this.partnerName = '';
        this.isHost = false;
    }
}

// Exportar como global
window.NetworkManager = NetworkManager;
