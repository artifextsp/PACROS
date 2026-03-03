/* ========================================
   CHAT.JS - Sistema de chat en tiempo real
   Burbujas de mensajes entre jugadores
   ======================================== */

class ChatManager {
    constructor(networkManager) {
        this.network = networkManager;
        this.containers = [];
        this.inputs = [];
        this.initialized = false;
    }

    // Inicializar el chat con los contenedores del DOM
    init() {
        if (this.initialized) return;

        // Chat durante el juego (desktop)
        this._registrarContenedor(
            document.getElementById('chat-messages'),
            document.getElementById('chat-input'),
            document.getElementById('btn-send-chat')
        );

        // Chat móvil overlay
        this._registrarContenedor(
            document.getElementById('mobile-chat-messages'),
            document.getElementById('mobile-chat-input'),
            document.getElementById('btn-mobile-send')
        );

        // Chat post-partida
        this._registrarContenedor(
            document.getElementById('post-chat-messages'),
            document.getElementById('post-chat-input'),
            document.getElementById('btn-post-send')
        );

        // Escuchar mensajes entrantes de Firebase
        this.network.escucharChat((msg) => {
            this._mostrarMensaje(msg);
        });

        this.initialized = true;
    }

    // Registrar un contenedor de chat (puede haber varios sincronizados)
    _registrarContenedor(messagesDiv, inputField, sendBtn) {
        if (!messagesDiv || !inputField || !sendBtn) return;

        const container = { messagesDiv, inputField, sendBtn };
        this.containers.push(container);

        // Evento de enviar con botón
        sendBtn.addEventListener('click', () => {
            this._enviarDesdeInput(inputField);
        });

        // Evento de enviar con Enter
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._enviarDesdeInput(inputField);
            }
        });
    }

    // Enviar mensaje desde un campo de input
    _enviarDesdeInput(inputField) {
        const texto = inputField.value.trim();
        if (!texto) return;

        this.network.enviarMensaje(texto);
        inputField.value = '';
        inputField.focus();
    }

    // Mostrar un mensaje en todos los contenedores de chat
    _mostrarMensaje(msg) {
        this.containers.forEach((container) => {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble ' + (msg.isMine ? 'mine' : 'theirs');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'bubble-name';
            nameSpan.textContent = msg.isMine ? 'Tú' : msg.name;

            const textNode = document.createTextNode(msg.text);

            bubble.appendChild(nameSpan);
            bubble.appendChild(textNode);

            container.messagesDiv.appendChild(bubble);
            container.messagesDiv.scrollTop = container.messagesDiv.scrollHeight;
        });
    }

    // Mostrar mensaje del sistema (no viene de Firebase)
    mostrarMensajeSistema(texto) {
        this.containers.forEach((container) => {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble system';
            bubble.textContent = texto;
            container.messagesDiv.appendChild(bubble);
            container.messagesDiv.scrollTop = container.messagesDiv.scrollHeight;
        });
    }

    // Limpiar todos los mensajes
    limpiar() {
        this.containers.forEach((container) => {
            container.messagesDiv.innerHTML = '';
        });
    }
}

window.ChatManager = ChatManager;
