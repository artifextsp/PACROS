/* ========================================
   GAME.JS - Motor del juego Pac-Man Caleño
   Canvas API, laberinto, fantasmas, niveles
   ======================================== */

// ==================== CONSTANTES ====================

// Tipos de celda en el laberinto
const CELL = {
    PATH: 0,        // Camino con rosquilla
    WALL: 1,        // Muro
    EMPTY: 2,       // Camino vacío (sin rosquilla)
    POWER: 3,       // Rosquilla grande (power pellet)
    GHOST_HOUSE: 4, // Casa de fantasmas
    PLAYER_START: 5 // Inicio del jugador
};

// Direcciones
const DIR = {
    NONE: null,
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// Laberinto 19 columnas x 21 filas
const MAZE_TEMPLATE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,3,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,3,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,4,1,1,2,1,0,1,1,1,1],
    [2,2,2,2,0,2,2,1,4,4,4,1,2,2,0,2,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,3,0,1,0,0,0,0,0,5,0,0,0,0,0,1,0,3,1],
    [1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const COLS = 19;
const ROWS = 21;

// Colores de los fantasmas
const GHOST_COLORS = ['#FF0000', '#FFB8DE', '#00FFFF', '#FFB852'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

// Configuración por nivel (velocidades en tiles/ms)
// A 60fps (delta~16.67ms): pacSpeed 0.0025 → ~2.5 tiles/s, ghostSpeed 0.001 → ~1 tile/s
const LEVEL_CONFIG = [
    { ghostSpeed: 0.001,  pacSpeed: 0.0025, frightenedTime: 12000, ghostDelay: [0, 8, 16, 24] },
    { ghostSpeed: 0.0013, pacSpeed: 0.0028, frightenedTime: 10000, ghostDelay: [0, 6, 12, 18] },
    { ghostSpeed: 0.0016, pacSpeed: 0.003,  frightenedTime: 8000,  ghostDelay: [0, 5, 10, 15] },
    { ghostSpeed: 0.0018, pacSpeed: 0.003,  frightenedTime: 7000,  ghostDelay: [0, 4, 8, 12] },
    { ghostSpeed: 0.002,  pacSpeed: 0.003,  frightenedTime: 6000,  ghostDelay: [0, 3, 6, 9] },
];

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 0;
        this.running = false;
        this.paused = false;
        this.isAI = false;
        this.guestMode = false; // Si es true, no ejecuta lógica, solo renderiza

        // Estado del juego
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.totalDots = 0;
        this.dotsEaten = 0;
        this.maze = [];

        // Pac-Man
        this.pacman = {
            x: 9, y: 15,
            dir: DIR.RIGHT,
            nextDir: DIR.RIGHT,
            mouthAngle: 0,
            mouthSpeed: 0.15,
            mouthOpen: true
        };

        // Fantasmas
        this.ghosts = [];

        // Estado de power-up
        this.frightened = false;
        this.frightenedTimer = null;

        // Animación
        this.lastTime = 0;
        this.animFrame = null;

        // Callbacks externos
        this.onScoreChange = null;
        this.onLevelChange = null;
        this.onLivesChange = null;
        this.onGameOver = null;
        this.onLevelComplete = null;

        // Input del compañero (multijugador)
        this.partnerDir = null;

        // Polyfill para roundRect en navegadores antiguos
        if (!CanvasRenderingContext2D.prototype.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
                const r = typeof radii === 'number' ? radii : (radii[0] || 0);
                this.moveTo(x + r, y);
                this.arcTo(x + w, y, x + w, y + h, r);
                this.arcTo(x + w, y + h, x, y + h, r);
                this.arcTo(x, y + h, x, y, r);
                this.arcTo(x, y, x + w, y, r);
            };
        }

        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    // ==================== CONFIGURACIÓN DEL CANVAS ====================

    _resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        const maxW = wrapper.clientWidth - 10;
        const maxH = wrapper.clientHeight - 10;

        const aspectRatio = COLS / ROWS;
        let w, h;

        if (maxW / maxH > aspectRatio) {
            h = maxH;
            w = h * aspectRatio;
        } else {
            w = maxW;
            h = w / aspectRatio;
        }

        w = Math.floor(w);
        h = Math.floor(h);

        this.canvas.width = w;
        this.canvas.height = h;
        this.tileSize = w / COLS;

        if (this.running && !this.paused) {
            this._render();
        }
    }

    // ==================== INICIALIZACIÓN DEL NIVEL ====================

    initLevel(levelNum) {
        this.level = Math.min(levelNum, LEVEL_CONFIG.length);
        this.dotsEaten = 0;
        this.totalDots = 0;
        this.frightened = false;

        if (this.frightenedTimer) {
            clearTimeout(this.frightenedTimer);
            this.frightenedTimer = null;
        }

        // Copiar laberinto
        this.maze = MAZE_TEMPLATE.map(row => [...row]);

        // Contar rosquillas
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.maze[r][c] === CELL.PATH || this.maze[r][c] === CELL.POWER) {
                    this.totalDots++;
                }
                if (this.maze[r][c] === CELL.PLAYER_START) {
                    this.maze[r][c] = CELL.EMPTY;
                }
            }
        }

        // Posicionar Pac-Man
        this.pacman.x = 9;
        this.pacman.y = 15;
        this.pacman.dir = DIR.RIGHT;
        this.pacman.nextDir = DIR.RIGHT;

        // Crear fantasmas
        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
        this.ghosts = [];

        const ghostStartPositions = [
            { x: 9, y: 8 },   // Blinky - fuera de la casa
            { x: 8, y: 9 },   // Pinky
            { x: 9, y: 9 },   // Inky
            { x: 10, y: 9 },  // Clyde
        ];

        for (let i = 0; i < 4; i++) {
            this.ghosts.push({
                x: ghostStartPositions[i].x,
                y: ghostStartPositions[i].y,
                dir: DIR.UP,
                color: GHOST_COLORS[i],
                name: GHOST_NAMES[i],
                speed: config.ghostSpeed,
                frightened: false,
                eaten: false,
                inHouse: i > 0,
                releaseTimer: config.ghostDelay[i] * 1000,
                scatterTarget: this._getScatterTarget(i)
            });
        }

        if (this.onLevelChange) this.onLevelChange(this.level);
        if (this.onLivesChange) this.onLivesChange(this.lives);
        if (this.onScoreChange) this.onScoreChange(this.score);
    }

    // Objetivos de dispersión (esquinas)
    _getScatterTarget(ghostIndex) {
        const targets = [
            { x: COLS - 2, y: 0 },
            { x: 1, y: 0 },
            { x: COLS - 2, y: ROWS - 1 },
            { x: 1, y: ROWS - 1 }
        ];
        return targets[ghostIndex];
    }

    // ==================== BUCLE PRINCIPAL ====================

    start() {
        if (this.running) return;
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        this._gameLoop(this.lastTime);
    }

    stop() {
        this.running = false;
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (this.paused) {
            this.paused = false;
            this.lastTime = performance.now();
        }
    }

    _gameLoop(timestamp) {
        if (!this.running) return;

        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (!this.paused) {
            if (this.guestMode) {
                // El guest solo anima la boca y renderiza (el estado llega del host)
                this.pacman.mouthAngle += this.pacman.mouthSpeed * (delta / 16);
                if (this.pacman.mouthAngle > 0.9) this.pacman.mouthSpeed = -Math.abs(this.pacman.mouthSpeed);
                if (this.pacman.mouthAngle < 0.05) this.pacman.mouthSpeed = Math.abs(this.pacman.mouthSpeed);
            } else {
                this._update(delta);
            }
            this._render();
        }

        this.animFrame = requestAnimationFrame((t) => this._gameLoop(t));
    }

    // ==================== ACTUALIZACIÓN DEL JUEGO ====================

    _update(delta) {
        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];

        // Actualizar animación de boca
        this.pacman.mouthAngle += this.pacman.mouthSpeed * (delta / 16);
        if (this.pacman.mouthAngle > 0.9) this.pacman.mouthSpeed = -Math.abs(this.pacman.mouthSpeed);
        if (this.pacman.mouthAngle < 0.05) this.pacman.mouthSpeed = Math.abs(this.pacman.mouthSpeed);

        // Mover Pac-Man
        this._moverPacman(config.pacSpeed, delta);

        // Mover fantasmas
        this.ghosts.forEach((ghost) => {
            if (ghost.inHouse) {
                ghost.releaseTimer -= delta;
                if (ghost.releaseTimer <= 0) {
                    ghost.inHouse = false;
                    ghost.x = 9;
                    ghost.y = 8;
                    ghost.dir = DIR.LEFT;
                }
                return;
            }
            if (ghost.eaten) {
                this._moverFantasmaACasa(ghost, delta);
                return;
            }
            this._moverFantasma(ghost, delta);
        });

        // Colisiones con rosquillas
        this._checkDotCollision();

        // Colisiones con fantasmas
        this._checkGhostCollision();

        // Verificar nivel completo
        if (this.dotsEaten >= this.totalDots) {
            this._nivelCompleto();
        }
    }

    // ==================== MOVIMIENTO DE PAC-MAN ====================

    _moverPacman(speed, delta) {
        const moveAmount = speed * delta;

        // Intentar cambiar a la dirección deseada cuando está cerca del centro de una celda
        if (this.pacman.nextDir && this.pacman.nextDir !== this.pacman.dir) {
            const nearX = Math.abs(this.pacman.x - Math.round(this.pacman.x)) < 0.18;
            const nearY = Math.abs(this.pacman.y - Math.round(this.pacman.y)) < 0.18;

            if (nearX && nearY) {
                const cx = Math.round(this.pacman.x);
                const cy = Math.round(this.pacman.y);
                const targetX = cx + this.pacman.nextDir.x;
                const targetY = cy + this.pacman.nextDir.y;

                if (this._canMove(targetX, targetY)) {
                    this.pacman.x = cx;
                    this.pacman.y = cy;
                    this.pacman.dir = this.pacman.nextDir;
                }
            }
        }

        if (!this.pacman.dir) return;

        const newX = this.pacman.x + this.pacman.dir.x * moveAmount;
        const newY = this.pacman.y + this.pacman.dir.y * moveAmount;

        // Túnel (wrap around)
        if (newX < -0.5) {
            this.pacman.x = COLS - 0.5;
            return;
        }
        if (newX > COLS - 0.5) {
            this.pacman.x = -0.5;
            return;
        }

        if (this._canMove(newX, newY)) {
            this.pacman.x = newX;
            this.pacman.y = newY;
        } else {
            // Snap al grid cuando choca contra un muro para evitar flotar entre celdas
            this.pacman.x = Math.round(this.pacman.x);
            this.pacman.y = Math.round(this.pacman.y);
        }
    }

    // Verificar si una posición es transitable
    _canMove(x, y) {
        const col = Math.round(x);
        const row = Math.round(y);

        // Fuera de límites horizontales (túneles)
        if (col < 0 || col >= COLS) return true;
        if (row < 0 || row >= ROWS) return false;

        const cell = this.maze[row][col];
        return cell !== CELL.WALL && cell !== CELL.GHOST_HOUSE;
    }

    // Verificar si un fantasma puede moverse a una posición
    _canMoveGhost(x, y, allowHouse) {
        const col = Math.round(x);
        const row = Math.round(y);
        if (col < 0 || col >= COLS) return true;
        if (row < 0 || row >= ROWS) return false;
        const cell = this.maze[row][col];
        if (allowHouse) return cell !== CELL.WALL;
        return cell !== CELL.WALL && cell !== CELL.GHOST_HOUSE;
    }

    // ==================== MOVIMIENTO DE FANTASMAS ====================

    _moverFantasma(ghost, delta) {
        const moveAmount = ghost.speed * delta;

        // Verificar si el fantasma está en el centro de una celda (para tomar decisiones)
        const nearCenterX = Math.abs(ghost.x - Math.round(ghost.x)) < 0.08;
        const nearCenterY = Math.abs(ghost.y - Math.round(ghost.y)) < 0.08;

        if (nearCenterX && nearCenterY) {
            ghost.x = Math.round(ghost.x);
            ghost.y = Math.round(ghost.y);

            // Determinar objetivo según modo
            let target;
            if (ghost.frightened) {
                // Movimiento aleatorio cuando está asustado
                target = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
            } else {
                target = this._getGhostTarget(ghost);
            }

            // Encontrar mejor dirección hacia el objetivo
            ghost.dir = this._bestDirection(ghost, target);
        }

        // Aplicar movimiento
        if (ghost.dir) {
            const newX = ghost.x + ghost.dir.x * moveAmount;
            const newY = ghost.y + ghost.dir.y * moveAmount;

            // Túnel
            if (newX < -0.5) { ghost.x = COLS - 0.5; return; }
            if (newX > COLS - 0.5) { ghost.x = -0.5; return; }

            if (this._canMoveGhost(newX, newY, false)) {
                ghost.x = newX;
                ghost.y = newY;
            } else {
                ghost.x = Math.round(ghost.x);
                ghost.y = Math.round(ghost.y);
                ghost.dir = this._bestDirection(ghost, this._getGhostTarget(ghost));
            }
        }
    }

    // Mover fantasma comido de vuelta a la casa
    _moverFantasmaACasa(ghost, delta) {
        const speed = 0.003 * delta;
        const homeX = 9, homeY = 9;
        const dx = homeX - ghost.x;
        const dy = homeY - ghost.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.3) {
            ghost.x = homeX;
            ghost.y = homeY;
            ghost.eaten = false;
            ghost.frightened = false;
            ghost.inHouse = true;
            ghost.releaseTimer = 2000;
            return;
        }

        ghost.x += (dx / dist) * speed;
        ghost.y += (dy / dist) * speed;
    }

    // Objetivo de cada fantasma según su personalidad
    _getGhostTarget(ghost) {
        const px = Math.round(this.pacman.x);
        const py = Math.round(this.pacman.y);

        switch (ghost.name) {
            case 'Blinky':
                return { x: px, y: py };
            case 'Pinky': {
                const dir = this.pacman.dir || DIR.RIGHT;
                return { x: px + dir.x * 4, y: py + dir.y * 4 };
            }
            case 'Inky': {
                const blinky = this.ghosts[0];
                const ahead = { x: px + (this.pacman.dir || DIR.RIGHT).x * 2, y: py + (this.pacman.dir || DIR.RIGHT).y * 2 };
                return { x: ahead.x + (ahead.x - Math.round(blinky.x)), y: ahead.y + (ahead.y - Math.round(blinky.y)) };
            }
            case 'Clyde': {
                const dist = Math.sqrt((ghost.x - px) ** 2 + (ghost.y - py) ** 2);
                return dist > 8 ? { x: px, y: py } : ghost.scatterTarget;
            }
            default:
                return { x: px, y: py };
        }
    }

    // Encontrar la mejor dirección para el fantasma
    _bestDirection(ghost, target) {
        const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
        let bestDir = ghost.dir || DIR.UP;
        let bestDist = Infinity;

        // No puede dar vuelta 180 grados
        const reverseX = ghost.dir ? -ghost.dir.x : 0;
        const reverseY = ghost.dir ? -ghost.dir.y : 0;

        for (const d of dirs) {
            if (d.x === reverseX && d.y === reverseY) continue;

            const nx = Math.round(ghost.x) + d.x;
            const ny = Math.round(ghost.y) + d.y;

            if (!this._canMoveGhost(nx, ny, false)) continue;

            const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = d;
            }
        }

        return bestDir;
    }

    // ==================== COLISIONES ====================

    _checkDotCollision() {
        const col = Math.round(this.pacman.x);
        const row = Math.round(this.pacman.y);

        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

        const cell = this.maze[row][col];

        if (cell === CELL.PATH) {
            this.maze[row][col] = CELL.EMPTY;
            this.dotsEaten++;
            this.score += 10;
            if (this.onScoreChange) this.onScoreChange(this.score);
        } else if (cell === CELL.POWER) {
            this.maze[row][col] = CELL.EMPTY;
            this.dotsEaten++;
            this.score += 50;
            if (this.onScoreChange) this.onScoreChange(this.score);
            this._activarPowerUp();
        }
    }

    _checkGhostCollision() {
        for (const ghost of this.ghosts) {
            if (ghost.inHouse || ghost.eaten) continue;

            const dx = this.pacman.x - ghost.x;
            const dy = this.pacman.y - ghost.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.45) {
                if (ghost.frightened) {
                    ghost.eaten = true;
                    this.score += 200;
                    if (this.onScoreChange) this.onScoreChange(this.score);
                } else {
                    this._pacmanMuere();
                    return;
                }
            }
        }
    }

    // ==================== POWER-UP ====================

    _activarPowerUp() {
        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];

        this.frightened = true;
        this.ghosts.forEach((g) => {
            if (!g.inHouse && !g.eaten) g.frightened = true;
        });

        if (this.frightenedTimer) clearTimeout(this.frightenedTimer);
        this.frightenedTimer = setTimeout(() => {
            this.frightened = false;
            this.ghosts.forEach((g) => { g.frightened = false; });
            this.frightenedTimer = null;
        }, config.frightenedTime);
    }

    // ==================== MUERTE Y GAME OVER ====================

    _pacmanMuere() {
        this.lives--;
        if (this.onLivesChange) this.onLivesChange(this.lives);

        if (this.lives <= 0) {
            this.stop();
            if (this.onGameOver) this.onGameOver(this.score, this.level);
            return;
        }

        // Reiniciar posiciones
        this.pacman.x = 9;
        this.pacman.y = 15;
        this.pacman.dir = DIR.RIGHT;
        this.pacman.nextDir = DIR.RIGHT;

        this.frightened = false;
        if (this.frightenedTimer) {
            clearTimeout(this.frightenedTimer);
            this.frightenedTimer = null;
        }

        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
        const ghostStartPositions = [
            { x: 9, y: 8 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }
        ];
        this.ghosts.forEach((ghost, i) => {
            ghost.x = ghostStartPositions[i].x;
            ghost.y = ghostStartPositions[i].y;
            ghost.dir = DIR.UP;
            ghost.frightened = false;
            ghost.eaten = false;
            ghost.inHouse = i > 0;
            ghost.releaseTimer = config.ghostDelay[i] * 1000;
        });

        // Pausa breve
        this.pause();
        setTimeout(() => this.resume(), 1500);
    }

    // Nivel completado
    _nivelCompleto() {
        this.stop();
        this.score += 1000;
        if (this.onScoreChange) this.onScoreChange(this.score);

        if (this.level >= LEVEL_CONFIG.length) {
            // Juego completado
            if (this.onGameOver) this.onGameOver(this.score, this.level, true);
        } else {
            if (this.onLevelComplete) this.onLevelComplete(this.level, this.score);
        }
    }

    // Avanzar al siguiente nivel
    siguienteNivel() {
        this.initLevel(this.level + 1);
        this.start();
    }

    // ==================== INPUT ====================

    setDirection(dirName) {
        const dirMap = { 'up': DIR.UP, 'down': DIR.DOWN, 'left': DIR.LEFT, 'right': DIR.RIGHT };
        const d = dirMap[dirName];
        if (d) {
            this.pacman.nextDir = d;
        }
    }

    // Recibir input del compañero
    setPartnerDirection(dirName) {
        this.setDirection(dirName);
    }

    // ==================== IA SIMPLE (modo solo) ====================

    updateAI() {
        if (!this.running || this.paused) return;

        // IA busca la rosquilla más cercana
        const px = Math.round(this.pacman.x);
        const py = Math.round(this.pacman.y);
        let closestDot = null;
        let closestDist = Infinity;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.maze[r][c] === CELL.PATH || this.maze[r][c] === CELL.POWER) {
                    const dist = Math.abs(c - px) + Math.abs(r - py);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestDot = { x: c, y: r };
                    }
                }
            }
        }

        if (!closestDot) return;

        // Determinar dirección hacia la rosquilla más cercana, evitando muros
        const dirs = ['up', 'down', 'left', 'right'];
        const dirVecs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
        let bestDir = 'right';
        let bestScore = -Infinity;

        for (let i = 0; i < 4; i++) {
            const nx = px + dirVecs[i].x;
            const ny = py + dirVecs[i].y;
            if (!this._canMove(nx, ny)) continue;

            // Distancia al objetivo
            let score = -(Math.abs(nx - closestDot.x) + Math.abs(ny - closestDot.y));

            // Evitar fantasmas
            for (const ghost of this.ghosts) {
                if (ghost.eaten || ghost.inHouse) continue;
                const gDist = Math.abs(nx - Math.round(ghost.x)) + Math.abs(ny - Math.round(ghost.y));
                if (!ghost.frightened && gDist < 3) {
                    score -= (4 - gDist) * 50;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestDir = dirs[i];
            }
        }

        this.setDirection(bestDir);
    }

    // ==================== RENDERIZADO ====================

    _render() {
        const ctx = this.ctx;
        const ts = this.tileSize;

        // Fondo
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dibujar laberinto
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const x = c * ts;
                const y = r * ts;
                const cell = this.maze[r][c];

                if (cell === CELL.WALL) {
                    this._drawWall(ctx, x, y, ts, r, c);
                } else if (cell === CELL.PATH) {
                    this._drawRosquilla(ctx, x + ts / 2, y + ts / 2, ts * 0.15, false);
                } else if (cell === CELL.POWER) {
                    this._drawRosquilla(ctx, x + ts / 2, y + ts / 2, ts * 0.3, true);
                }
            }
        }

        // Dibujar fantasmas
        this.ghosts.forEach((ghost) => {
            this._drawGhost(ctx, ghost, ts);
        });

        // Dibujar Pac-Man
        this._drawPacman(ctx, ts);
    }

    // Dibujar muro con bordes redondeados
    _drawWall(ctx, x, y, ts, row, col) {
        ctx.fillStyle = '#1a3a6e';
        ctx.strokeStyle = '#3366cc';
        ctx.lineWidth = 1;

        const padding = 1;
        const r = ts * 0.2;

        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, ts - padding * 2, ts - padding * 2, r);
        ctx.fill();
        ctx.stroke();
    }

    // Dibujar rosquilla (donut)
    _drawRosquilla(ctx, cx, cy, radius, isPower) {
        const time = performance.now();

        if (isPower) {
            // Rosquilla grande pulsa
            const pulse = 1 + Math.sin(time / 200) * 0.2;
            radius *= pulse;
        }

        // Anillo exterior (donut)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isPower ? '#FFD700' : '#D4842A';
        ctx.fill();

        // Agujero del donut
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a1a';
        ctx.fill();

        if (isPower) {
            // Brillo
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.fill();
        }
    }

    // Dibujar Pac-Man con sombrero caleño
    _drawPacman(ctx, ts) {
        const cx = this.pacman.x * ts + ts / 2;
        const cy = this.pacman.y * ts + ts / 2;
        const radius = ts * 0.42;
        const mouth = this.pacman.mouthAngle;

        // Ángulo de rotación según dirección
        let angle = 0;
        const d = this.pacman.dir;
        if (d === DIR.RIGHT) angle = 0;
        else if (d === DIR.DOWN) angle = Math.PI / 2;
        else if (d === DIR.LEFT) angle = Math.PI;
        else if (d === DIR.UP) angle = -Math.PI / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Cuerpo de Pac-Man
        ctx.beginPath();
        ctx.arc(0, 0, radius, mouth * 0.8, -mouth * 0.8 + Math.PI * 2);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#E6B800';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ojo
        const eyeX = radius * 0.2;
        const eyeY = -radius * 0.4;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, radius * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

        ctx.restore();

        // Sombrerito caleño (encima de Pac-Man)
        this._drawHat(ctx, cx, cy - radius * 0.7, ts);
    }

    // Sombrerito decorativo
    _drawHat(ctx, cx, cy, ts) {
        const w = ts * 0.55;
        const h = ts * 0.2;

        // Ala del sombrero
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.ellipse(cx, cy + h * 0.3, w * 0.6, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Copa del sombrero
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(cx - w * 0.25, cy - h * 0.8, w * 0.5, h * 1.1);

        // Cinta del sombrero
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - w * 0.27, cy + h * 0.05, w * 0.54, h * 0.2);
    }

    // Dibujar fantasma
    _drawGhost(ctx, ghost, ts) {
        const cx = ghost.x * ts + ts / 2;
        const cy = ghost.y * ts + ts / 2;
        const radius = ts * 0.4;

        let color = ghost.color;
        if (ghost.frightened) {
            color = '#2222DD';
            // Parpadeo cuando queda poco tiempo de fright
            if (this.frightenedTimer) {
                const remaining = this.frightenedTimer._idleStart ? 0 : 0;
                if (performance.now() % 400 < 200) {
                    color = '#FFFFFF';
                }
            }
        }
        if (ghost.eaten) {
            // Solo dibujar ojos
            this._drawGhostEyes(ctx, cx, cy, radius);
            return;
        }

        // Cuerpo del fantasma
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - radius * 0.1, radius, Math.PI, 0, false);
        ctx.lineTo(cx + radius, cy + radius * 0.7);

        // Ondulación inferior
        const wave = 3;
        const waveWidth = (radius * 2) / wave;
        for (let i = 0; i < wave; i++) {
            const wx = cx + radius - (i + 1) * waveWidth;
            const wy = cy + radius * 0.7;
            ctx.quadraticCurveTo(
                wx + waveWidth / 2, wy + radius * 0.3,
                wx, wy
            );
        }

        ctx.closePath();
        ctx.fill();

        // Ojos
        if (ghost.frightened) {
            // Ojos asustados
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cx - radius * 0.25, cy - radius * 0.15, radius * 0.18, 0, Math.PI * 2);
            ctx.arc(cx + radius * 0.25, cy - radius * 0.15, radius * 0.18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            this._drawGhostEyes(ctx, cx, cy, radius);
        }
    }

    // Dibujar ojos del fantasma
    _drawGhostEyes(ctx, cx, cy, radius) {
        // Blanco de los ojos
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(cx - radius * 0.28, cy - radius * 0.15, radius * 0.2, radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + radius * 0.28, cy - radius * 0.15, radius * 0.2, radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupilas (miran hacia Pac-Man)
        const dx = this.pacman.x - cx / this.tileSize;
        const dy = this.pacman.y - cy / this.tileSize;
        const angle = Math.atan2(dy, dx);
        const pupilOffset = radius * 0.08;

        ctx.fillStyle = '#1111AA';
        ctx.beginPath();
        ctx.arc(
            cx - radius * 0.28 + Math.cos(angle) * pupilOffset,
            cy - radius * 0.15 + Math.sin(angle) * pupilOffset,
            radius * 0.12, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
            cx + radius * 0.28 + Math.cos(angle) * pupilOffset,
            cy - radius * 0.15 + Math.sin(angle) * pupilOffset,
            radius * 0.12, 0, Math.PI * 2
        );
        ctx.fill();
    }

    // ==================== ESTADO SERIALIZABLE (para multijugador) ====================

    getState() {
        return {
            px: Math.round(this.pacman.x * 100) / 100,
            py: Math.round(this.pacman.y * 100) / 100,
            pd: this._dirToString(this.pacman.dir),
            pnd: this._dirToString(this.pacman.nextDir),
            pm: Math.round(this.pacman.mouthAngle * 100) / 100,
            ghosts: this.ghosts.map(g => ({
                x: Math.round(g.x * 100) / 100,
                y: Math.round(g.y * 100) / 100,
                d: this._dirToString(g.dir),
                f: g.frightened,
                e: g.eaten,
                ih: g.inHouse
            })),
            score: this.score,
            lives: this.lives,
            level: this.level,
            maze: this._compressMaze(),
            fr: this.frightened,
            de: this.dotsEaten
        };
    }

    applyState(state) {
        if (!state) return;
        this.pacman.x = state.px;
        this.pacman.y = state.py;
        this.pacman.dir = this._stringToDir(state.pd);
        this.pacman.nextDir = this._stringToDir(state.pnd);
        this.pacman.mouthAngle = state.pm;

        if (state.ghosts) {
            state.ghosts.forEach((gs, i) => {
                if (this.ghosts[i]) {
                    this.ghosts[i].x = gs.x;
                    this.ghosts[i].y = gs.y;
                    this.ghosts[i].dir = this._stringToDir(gs.d);
                    this.ghosts[i].frightened = gs.f;
                    this.ghosts[i].eaten = gs.e;
                    this.ghosts[i].inHouse = gs.ih;
                }
            });
        }

        this.score = state.score;
        this.lives = state.lives;
        this.level = state.level;
        this.frightened = state.fr;
        this.dotsEaten = state.de;

        if (state.maze) {
            this._decompressMaze(state.maze);
        }

        if (this.onScoreChange) this.onScoreChange(this.score);
        if (this.onLivesChange) this.onLivesChange(this.lives);
        if (this.onLevelChange) this.onLevelChange(this.level);

        this._render();
    }

    // Comprimir laberinto (solo cambios de rosquillas comidas)
    _compressMaze() {
        const eaten = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const orig = MAZE_TEMPLATE[r][c];
                if ((orig === CELL.PATH || orig === CELL.POWER) && this.maze[r][c] === CELL.EMPTY) {
                    eaten.push(r * COLS + c);
                }
            }
        }
        return eaten;
    }

    _decompressMaze(eaten) {
        this.maze = MAZE_TEMPLATE.map(row => [...row]);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.maze[r][c] === CELL.PLAYER_START) {
                    this.maze[r][c] = CELL.EMPTY;
                }
            }
        }
        eaten.forEach(idx => {
            const r = Math.floor(idx / COLS);
            const c = idx % COLS;
            this.maze[r][c] = CELL.EMPTY;
        });
    }

    _dirToString(d) {
        if (!d) return 'n';
        if (d === DIR.UP) return 'u';
        if (d === DIR.DOWN) return 'd';
        if (d === DIR.LEFT) return 'l';
        if (d === DIR.RIGHT) return 'r';
        return 'n';
    }

    _stringToDir(s) {
        switch (s) {
            case 'u': return DIR.UP;
            case 'd': return DIR.DOWN;
            case 'l': return DIR.LEFT;
            case 'r': return DIR.RIGHT;
            default: return DIR.NONE;
        }
    }
}

window.GameEngine = GameEngine;
