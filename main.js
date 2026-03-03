/* ========================================
   MAIN.JS - Orquestador principal
   Conecta pantallas, red, chat y juego
   100% cooperativo: dos personas, dos Pac-Men
   ======================================== */

(function () {
    'use strict';

    // ==================== REFERENCIAS AL DOM ====================
    const screens = {
        intro: document.getElementById('screen-intro'),
        waiting: document.getElementById('screen-waiting'),
        introPlayers: document.getElementById('screen-intro-players'),
        game: document.getElementById('screen-game'),
        results: document.getElementById('screen-results')
    };

    const dom = {
        playerNameInput: document.getElementById('player-name'),
        btnPlay: document.getElementById('btn-play'),
        waitingStatus: document.getElementById('waiting-status'),
        waitingTimer: document.getElementById('waiting-timer'),
        btnCancelWait: document.getElementById('btn-cancel-wait'),
        introP1Name: document.getElementById('intro-p1-name'),
        introP2Name: document.getElementById('intro-p2-name'),
        countdownNum: document.getElementById('countdown-num'),
        hudScore: document.getElementById('hud-score'),
        hudLevel: document.getElementById('hud-level'),
        hudLives: document.getElementById('hud-lives'),
        gameOverlay: document.getElementById('game-overlay'),
        overlayText: document.getElementById('overlay-text'),
        resultsTitle: document.getElementById('results-title'),
        resultsP1: document.getElementById('results-p1'),
        resultsP2: document.getElementById('results-p2'),
        resultsScore: document.getElementById('results-score'),
        resultsLevel: document.getElementById('results-level'),
        prizeArea: document.getElementById('prize-area'),
        prizeTitle: document.getElementById('prize-title'),
        prizeDescription: document.getElementById('prize-description'),
        prizeCode: document.getElementById('prize-code'),
        leaderboardList: document.getElementById('leaderboard-list'),
        btnPlayAgain: document.getElementById('btn-play-again'),
        btnExit: document.getElementById('btn-exit'),
        btnToggleChat: document.getElementById('btn-toggle-chat'),
        chatPanel: document.getElementById('chat-panel'),
        btnMobileChatFab: document.getElementById('btn-mobile-chat-fab'),
        mobileChatOverlay: document.getElementById('mobile-chat-overlay'),
        btnCloseMobileChat: document.getElementById('btn-close-mobile-chat'),
        touchControls: document.getElementById('touch-controls')
    };

    // ==================== INSTANCIAS GLOBALES ====================
    let network = null;
    let chat = null;
    let game = null;
    let waitingInterval = null;
    let syncInterval = null;

    // ==================== NAVEGACIÓN ENTRE PANTALLAS ====================

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[name]) {
            screens[name].classList.add('active');
        }
    }

    // ==================== INICIALIZACIÓN ====================

    function init() {
        network = new NetworkManager();
        const firebaseOk = network.init();

        if (!firebaseOk) {
            alert('Error: No se pudo conectar con Firebase. Revisa la configuración en network.js');
        }

        game = new GameEngine('game-canvas');
        chat = new ChatManager(network);

        setupIntroScreen();
        setupWaitingScreen();
        setupGameScreen();
        setupResultsScreen();
        setupNetworkCallbacks();

        showScreen('intro');
    }

    // ==================== PANTALLA DE INICIO ====================

    function setupIntroScreen() {
        dom.playerNameInput.addEventListener('input', () => {
            dom.btnPlay.disabled = dom.playerNameInput.value.trim().length < 1;
        });

        dom.btnPlay.addEventListener('click', () => {
            const name = dom.playerNameInput.value.trim();
            if (!name) return;
            startMatchmaking(name);
        });

        dom.playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && dom.playerNameInput.value.trim().length >= 1) {
                startMatchmaking(dom.playerNameInput.value.trim());
            }
        });
    }

    // ==================== MATCHMAKING ====================

    function startMatchmaking(name) {
        showScreen('waiting');
        dom.waitingStatus.textContent = 'Buscando a tu media rosquilla...';

        let elapsed = 0;
        waitingInterval = setInterval(() => {
            elapsed++;
            dom.waitingTimer.textContent = `${elapsed}s esperando...`;
            if (elapsed >= 60) {
                dom.waitingStatus.textContent = 'Sigue esperando... comparte el link con alguien 🍩';
            }
        }, 1000);

        network.buscarPareja(name);
    }

    function setupWaitingScreen() {
        dom.btnCancelWait.addEventListener('click', () => {
            clearInterval(waitingInterval);
            network.cancelarBusqueda();
            showScreen('intro');
        });
    }

    // ==================== CALLBACKS DE RED ====================

    function setupNetworkCallbacks() {
        network.on('parejaEncontrada', (data) => {
            clearInterval(waitingInterval);
            showPlayerIntro(data.partnerName);
        });

        // Host recibe input del guest → mueve pacman2
        network.on('inputRecibido', (input) => {
            if (game && game.running && network.isHost) {
                game.setPartnerDirection(input.dir);
            }
        });

        // Guest recibe estado completo del host → renderiza todo
        network.on('estadoJuego', (state) => {
            if (game && !network.isHost) {
                game.applyState(state);
                updateHUD();
            }
        });

        network.on('juegoIniciado', () => {
            if (!network.isHost) {
                startGame(false);
            }
        });

        network.on('companeroDesconectado', () => {
            if (chat) {
                chat.mostrarMensajeSistema('Tu compañero se desconectó 😢');
            }
            if (game && game.running) {
                game.pause();
                dom.gameOverlay.style.display = 'flex';
                dom.overlayText.textContent = '⚠️ Compañero desconectado';
                setTimeout(() => {
                    game.stop();
                    showResults(game.score, game.level, false);
                }, 3000);
            }
        });

        network.on('reinicioSolicitado', (data) => {
            if (data.by !== network.playerId) {
                const accept = confirm('Tu compañero quiere jugar de nuevo. ¿Aceptas?');
                if (accept) {
                    network.aceptarReinicio();
                    restartGame();
                }
            }
        });
    }

    // ==================== PRESENTACIÓN DE JUGADORES ====================

    function showPlayerIntro(partnerName) {
        showScreen('introPlayers');

        if (network.isHost) {
            dom.introP1Name.textContent = network.playerName + ' 🟡';
            dom.introP2Name.textContent = partnerName + ' 🟢';
        } else {
            dom.introP1Name.textContent = partnerName + ' 🟡';
            dom.introP2Name.textContent = network.playerName + ' 🟢';
        }

        let count = 5;
        dom.countdownNum.textContent = count;

        const countdownInterval = setInterval(() => {
            count--;
            dom.countdownNum.textContent = count;
            if (count <= 0) {
                clearInterval(countdownInterval);
                if (network.isHost) {
                    network.iniciarJuego();
                }
                startGame(network.isHost);
            }
        }, 1000);
    }

    // ==================== INICIO DEL JUEGO ====================

    function startGame(isHost) {
        showScreen('game');

        chat.init();

        if (isHost) {
            chat.mostrarMensajeSistema('¡La partida comenzó! 🟡 Tú controlas el Pac-Man amarillo');
        } else {
            chat.mostrarMensajeSistema('¡La partida comenzó! 🟢 Tú controlas el Pac-Man verde');
        }
        chat.mostrarMensajeSistema('¡Coordínense para limpiar el laberinto juntos! 🍩');

        if (window.innerWidth <= 768) {
            dom.btnMobileChatFab.style.display = 'flex';
            dom.touchControls.style.display = 'flex';
        }

        game.guestMode = !isHost;
        game.initLevel(1);
        setupGameCallbacks();

        dom.gameOverlay.style.display = 'flex';
        dom.overlayText.textContent = '¡LISTO!';

        setTimeout(() => {
            dom.gameOverlay.style.display = 'none';
            game.start();

            if (isHost) {
                startSyncLoop();
            }
        }, 2000);

        setTimeout(() => game._resizeCanvas(), 100);
    }

    // ==================== CALLBACKS DEL JUEGO ====================

    function setupGameCallbacks() {
        game.onScoreChange = (score) => {
            dom.hudScore.textContent = score;
        };

        game.onLevelChange = (level) => {
            dom.hudLevel.textContent = level;
        };

        game.onLivesChange = (lives) => {
            dom.hudLives.textContent = '❤️'.repeat(Math.max(0, lives));
        };

        game.onGameOver = (score, level, won) => {
            stopSyncLoop();
            showResults(score, level, won || false);
        };

        game.onLevelComplete = (level, score) => {
            dom.gameOverlay.style.display = 'flex';
            dom.overlayText.textContent = `¡Nivel ${level} completado! 🎉`;

            if (chat) {
                chat.mostrarMensajeSistema(`¡Nivel ${level} superado! +1000 puntos 🍩`);
            }

            setTimeout(() => {
                dom.gameOverlay.style.display = 'none';
                game.siguienteNivel();
            }, 2500);
        };
    }

    // ==================== SINCRONIZACIÓN MULTIJUGADOR ====================

    function startSyncLoop() {
        stopSyncLoop();
        let frameCount = 0;
        syncInterval = setInterval(() => {
            if (game && game.running && network.isHost) {
                frameCount++;
                if (frameCount % 3 === 0) {
                    network.enviarEstadoJuego(game.getState());
                }
            }
        }, 33);
    }

    function stopSyncLoop() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    // ==================== CONTROLES ====================

    function setupGameScreen() {
        // Teclado
        document.addEventListener('keydown', (e) => {
            if (!game || !game.running) return;

            let dir = null;
            switch (e.key) {
                case 'ArrowUp':    case 'w': case 'W': dir = 'up'; break;
                case 'ArrowDown':  case 's': case 'S': dir = 'down'; break;
                case 'ArrowLeft':  case 'a': case 'A': dir = 'left'; break;
                case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
            }

            if (dir) {
                e.preventDefault();

                if (network && network.isHost) {
                    // Host: controla pacman1 directamente
                    game.setDirection(dir);
                } else if (network && network.roomRef) {
                    // Guest: envía input al host → controlará pacman2
                    network.enviarInput(dir);
                }
            }
        });

        // D-pad táctil
        document.querySelectorAll('.dpad-btn').forEach((btn) => {
            const handler = (e) => {
                e.preventDefault();
                const dir = btn.dataset.dir;
                if (dir && game && game.running) {
                    if (network && network.isHost) {
                        game.setDirection(dir);
                    } else if (network && network.roomRef) {
                        network.enviarInput(dir);
                    }
                }
            };
            btn.addEventListener('touchstart', handler, { passive: false });
            btn.addEventListener('mousedown', handler);
        });

        // Chat toggle (desktop)
        dom.btnToggleChat.addEventListener('click', () => {
            dom.chatPanel.classList.toggle('collapsed');
            dom.btnToggleChat.textContent = dom.chatPanel.classList.contains('collapsed') ? '+' : '−';
        });

        // Chat móvil FAB
        dom.btnMobileChatFab.addEventListener('click', () => {
            dom.mobileChatOverlay.style.display = 'flex';
        });

        dom.btnCloseMobileChat.addEventListener('click', () => {
            dom.mobileChatOverlay.style.display = 'none';
        });
    }

    function updateHUD() {
        dom.hudScore.textContent = game.score;
        dom.hudLevel.textContent = game.level;
        dom.hudLives.textContent = '❤️'.repeat(Math.max(0, game.lives));
    }

    // ==================== RESULTADOS ====================

    function setupResultsScreen() {
        dom.btnPlayAgain.addEventListener('click', () => {
            network.solicitarReinicio();
            dom.btnPlayAgain.textContent = 'Esperando al compañero...';
            dom.btnPlayAgain.disabled = true;
        });

        dom.btnExit.addEventListener('click', () => {
            network.desconectar();
            stopSyncLoop();
            dom.btnMobileChatFab.style.display = 'none';
            showScreen('intro');
        });
    }

    function showResults(score, level, won) {
        showScreen('results');
        dom.btnMobileChatFab.style.display = 'none';

        dom.resultsTitle.textContent = won ? '🎉 ¡VICTORIA! 🎉' : '💀 ¡Game Over!';
        dom.resultsP1.textContent = network.playerName || 'Jugador 1';
        dom.resultsP2.textContent = network.partnerName || 'Jugador 2';
        dom.resultsScore.textContent = score;
        dom.resultsLevel.textContent = level;

        showPrize(score);
        network.guardarPuntaje(score, level);
        loadLeaderboard();

        dom.btnPlayAgain.textContent = '🔄 Jugar de nuevo juntos';
        dom.btnPlayAgain.disabled = false;
    }

    function showPrize(score) {
        let prize = null;

        if (score >= 10000) {
            prize = {
                title: '🌟 ¡MEDIA ROSQUILLA VIP! 🌟',
                desc: 'Premio Élite: Experiencia VIP "Media Rosquilla" con tour gastronómico por Cali',
            };
        } else if (score >= 5000) {
            prize = {
                title: '🎉 ¡Tour por Cali!',
                desc: 'Premio Alto: Tour guiado por los mejores spots de Cali con degustación',
            };
        } else if (score >= 3000) {
            prize = {
                title: '🎬 ¡Entradas al Cine!',
                desc: 'Premio Medio: 2 entradas al cine con combo de rosquillas',
            };
        } else if (score >= 1000) {
            prize = {
                title: '🍩 ¡Pack de Rosquillas!',
                desc: 'Premio Básico: Pack de 12 rosquillas caleñas artesanales',
            };
        }

        if (prize) {
            dom.prizeArea.style.display = 'block';
            dom.prizeTitle.textContent = prize.title;
            dom.prizeDescription.textContent = prize.desc;
            const code = 'RQ-' + Date.now().toString(36).toUpperCase().slice(-6);
            dom.prizeCode.textContent = 'Código: ' + code;
        } else {
            dom.prizeArea.style.display = 'none';
        }
    }

    async function loadLeaderboard() {
        const entries = await network.obtenerLeaderboard();
        dom.leaderboardList.innerHTML = '';

        if (entries.length === 0) {
            dom.leaderboardList.innerHTML = '<p class="leaderboard-empty">Aún no hay puntajes registrados</p>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        entries.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-entry';
            div.innerHTML = `
                <span class="lb-rank">${medals[i] || (i + 1)}</span>
                <span class="lb-names">${entry.player1} & ${entry.player2}</span>
                <span class="lb-score">${entry.score}</span>
            `;
            dom.leaderboardList.appendChild(div);
        });
    }

    // ==================== REINICIAR PARTIDA ====================

    function restartGame() {
        game.stop();
        game.score = 0;
        game.lives = 3;
        stopSyncLoop();
        startGame(network.isHost);
    }

    // ==================== ARRANQUE ====================

    document.addEventListener('DOMContentLoaded', init);

})();
