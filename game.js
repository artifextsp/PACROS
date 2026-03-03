/* ========================================
   GAME.JS - Motor del juego Pac-Man Caleño
   Canvas API, laberinto, fantasmas, niveles
   Dos Pac-Men cooperativos — v2
   ======================================== */
console.log('GAME.JS v2 cargado — modo 2 Pac-Men');

// ==================== CONSTANTES ====================

const CELL = {
    PATH: 0,
    WALL: 1,
    EMPTY: 2,
    POWER: 3,
    GHOST_HOUSE: 4,
    PLAYER_START: 5
};

const DIR = {
    NONE: null,
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

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

const GHOST_COLORS = ['#FF0000', '#FFB8DE', '#00FFFF', '#FFB852'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

// Velocidades en tiles/ms — pacSpeed 0.0025 → ~2.5 tiles/s
const LEVEL_CONFIG = [
    { ghostSpeed: 0.001,  pacSpeed: 0.0025, frightenedTime: 12000, ghostDelay: [0, 8, 16, 24] },
    { ghostSpeed: 0.0013, pacSpeed: 0.0028, frightenedTime: 10000, ghostDelay: [0, 6, 12, 18] },
    { ghostSpeed: 0.0016, pacSpeed: 0.003,  frightenedTime: 8000,  ghostDelay: [0, 5, 10, 15] },
    { ghostSpeed: 0.0018, pacSpeed: 0.003,  frightenedTime: 7000,  ghostDelay: [0, 4, 8, 12] },
    { ghostSpeed: 0.002,  pacSpeed: 0.003,  frightenedTime: 6000,  ghostDelay: [0, 3, 6, 9] },
];

// Posiciones iniciales de los dos Pac-Men
const P1_START = { x: 9, y: 15 };
const P2_START = { x: 9, y: 3 };

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 0;
        this.running = false;
        this.paused = false;
        this.isAI = false;
        this.guestMode = false;

        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.totalDots = 0;
        this.dotsEaten = 0;
        this.maze = [];

        // Pac-Man 1 (jugador local) — amarillo con sombrero rojo
        this.pacman = this._createPacman(P1_START.x, P1_START.y, DIR.RIGHT, '#FFD700', '#E6B800', '#DC143C');

        // Pac-Man 2 (compañero) — verde lima con sombrero azul
        this.pacman2 = this._createPacman(P2_START.x, P2_START.y, DIR.LEFT, '#32CD32', '#28A428', '#1E90FF');

        this.ghosts = [];

        this.frightened = false;
        this.frightenedTimer = null;

        this.lastTime = 0;
        this.animFrame = null;

        this.onScoreChange = null;
        this.onLevelChange = null;
        this.onLivesChange = null;
        this.onGameOver = null;
        this.onLevelComplete = null;

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

    _createPacman(x, y, dir, bodyColor, strokeColor, hatColor) {
        return {
            x, y,
            dir: dir,
            nextDir: dir,
            mouthAngle: 0,
            mouthSpeed: 0.15,
            bodyColor,
            strokeColor,
            hatColor,
            startX: x,
            startY: y,
            startDir: dir
        };
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

        this.maze = MAZE_TEMPLATE.map(row => [...row]);

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

        // Limpiar celda de inicio de pacman2 (quitar rosquilla si hay)
        if (this.maze[P2_START.y][P2_START.x] === CELL.PATH) {
            this.maze[P2_START.y][P2_START.x] = CELL.EMPTY;
            this.totalDots--;
        }

        // Posicionar ambos Pac-Men
        this._resetPacman(this.pacman);
        this._resetPacman(this.pacman2);

        // Crear fantasmas — Blinky empieza FUERA de la casa (y=7, no y=8)
        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
        this.ghosts = [];

        const ghostStartPositions = [
            { x: 9, y: 7 },   // Blinky — fuera de la casa
            { x: 8, y: 9 },   // Pinky
            { x: 9, y: 9 },   // Inky
            { x: 10, y: 9 },  // Clyde
        ];

        for (let i = 0; i < 4; i++) {
            this.ghosts.push({
                x: ghostStartPositions[i].x,
                y: ghostStartPositions[i].y,
                dir: i === 0 ? DIR.LEFT : DIR.UP,
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

    _resetPacman(pac) {
        pac.x = pac.startX;
        pac.y = pac.startY;
        pac.dir = pac.startDir;
        pac.nextDir = pac.startDir;
    }

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

    pause() { this.paused = true; }

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
                this._animateMouth(this.pacman, delta);
                this._animateMouth(this.pacman2, delta);
            } else {
                this._update(delta);
            }
            this._render();
        }

        this.animFrame = requestAnimationFrame((t) => this._gameLoop(t));
    }

    _animateMouth(pac, delta) {
        pac.mouthAngle += pac.mouthSpeed * (delta / 16);
        if (pac.mouthAngle > 0.9) pac.mouthSpeed = -Math.abs(pac.mouthSpeed);
        if (pac.mouthAngle < 0.05) pac.mouthSpeed = Math.abs(pac.mouthSpeed);
    }

    // ==================== ACTUALIZACIÓN DEL JUEGO ====================

    _update(delta) {
        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];

        this._animateMouth(this.pacman, delta);
        this._animateMouth(this.pacman2, delta);

        // Mover ambos Pac-Men
        this._moverPacman(this.pacman, config.pacSpeed, delta);
        this._moverPacman(this.pacman2, config.pacSpeed, delta);

        // Mover fantasmas
        this.ghosts.forEach((ghost) => {
            if (ghost.inHouse) {
                ghost.releaseTimer -= delta;
                if (ghost.releaseTimer <= 0) {
                    ghost.inHouse = false;
                    ghost.x = 9;
                    ghost.y = 7; // Fuera de la ghost house
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

        // Colisiones con rosquillas — ambos pacmen
        this._checkDotCollision(this.pacman);
        this._checkDotCollision(this.pacman2);

        // Colisiones con fantasmas — ambos pacmen
        this._checkGhostCollision(this.pacman);
        this._checkGhostCollision(this.pacman2);

        if (this.dotsEaten >= this.totalDots) {
            this._nivelCompleto();
        }
    }

    // ==================== MOVIMIENTO DE PAC-MAN ====================

    _moverPacman(pac, speed, delta) {
        const moveAmount = speed * delta;

        if (pac.nextDir && pac.nextDir !== pac.dir) {
            const nearX = Math.abs(pac.x - Math.round(pac.x)) < 0.18;
            const nearY = Math.abs(pac.y - Math.round(pac.y)) < 0.18;

            if (nearX && nearY) {
                const cx = Math.round(pac.x);
                const cy = Math.round(pac.y);
                const targetX = cx + pac.nextDir.x;
                const targetY = cy + pac.nextDir.y;

                if (this._canMove(targetX, targetY)) {
                    pac.x = cx;
                    pac.y = cy;
                    pac.dir = pac.nextDir;
                }
            }
        }

        if (!pac.dir) return;

        const newX = pac.x + pac.dir.x * moveAmount;
        const newY = pac.y + pac.dir.y * moveAmount;

        if (newX < -0.5) { pac.x = COLS - 0.5; return; }
        if (newX > COLS - 0.5) { pac.x = -0.5; return; }

        if (this._canMove(newX, newY)) {
            pac.x = newX;
            pac.y = newY;
        } else {
            pac.x = Math.round(pac.x);
            pac.y = Math.round(pac.y);
        }
    }

    _canMove(x, y) {
        const col = Math.round(x);
        const row = Math.round(y);
        if (col < 0 || col >= COLS) return true;
        if (row < 0 || row >= ROWS) return false;
        const cell = this.maze[row][col];
        return cell !== CELL.WALL && cell !== CELL.GHOST_HOUSE;
    }

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

        const nearCenterX = Math.abs(ghost.x - Math.round(ghost.x)) < 0.08;
        const nearCenterY = Math.abs(ghost.y - Math.round(ghost.y)) < 0.08;

        if (nearCenterX && nearCenterY) {
            ghost.x = Math.round(ghost.x);
            ghost.y = Math.round(ghost.y);

            let target;
            if (ghost.frightened) {
                target = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
            } else {
                target = this._getGhostTarget(ghost);
            }

            ghost.dir = this._bestDirection(ghost, target);
        }

        if (ghost.dir) {
            const newX = ghost.x + ghost.dir.x * moveAmount;
            const newY = ghost.y + ghost.dir.y * moveAmount;

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
            ghost.releaseTimer = 3000;
            return;
        }

        ghost.x += (dx / dist) * speed;
        ghost.y += (dy / dist) * speed;
    }

    // Cada fantasma persigue al Pac-Man más cercano
    _getGhostTarget(ghost) {
        const nearest = this._nearestPacman(ghost.x, ghost.y);
        const px = Math.round(nearest.x);
        const py = Math.round(nearest.y);

        switch (ghost.name) {
            case 'Blinky':
                return { x: px, y: py };
            case 'Pinky': {
                const dir = nearest.dir || DIR.RIGHT;
                return { x: px + dir.x * 4, y: py + dir.y * 4 };
            }
            case 'Inky': {
                const blinky = this.ghosts[0];
                const ahead = { x: px + (nearest.dir || DIR.RIGHT).x * 2, y: py + (nearest.dir || DIR.RIGHT).y * 2 };
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

    _nearestPacman(gx, gy) {
        const d1 = Math.abs(this.pacman.x - gx) + Math.abs(this.pacman.y - gy);
        const d2 = Math.abs(this.pacman2.x - gx) + Math.abs(this.pacman2.y - gy);
        return d1 <= d2 ? this.pacman : this.pacman2;
    }

    _bestDirection(ghost, target) {
        const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
        let bestDir = ghost.dir || DIR.UP;
        let bestDist = Infinity;

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

    _checkDotCollision(pac) {
        const col = Math.round(pac.x);
        const row = Math.round(pac.y);

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

    _checkGhostCollision(pac) {
        for (const ghost of this.ghosts) {
            if (ghost.inHouse || ghost.eaten) continue;

            const dx = pac.x - ghost.x;
            const dy = pac.y - ghost.y;
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

        // Reiniciar ambos Pac-Men
        this._resetPacman(this.pacman);
        this._resetPacman(this.pacman2);

        this.frightened = false;
        if (this.frightenedTimer) {
            clearTimeout(this.frightenedTimer);
            this.frightenedTimer = null;
        }

        const config = LEVEL_CONFIG[this.level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
        const ghostStartPositions = [
            { x: 9, y: 7 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }
        ];
        this.ghosts.forEach((ghost, i) => {
            ghost.x = ghostStartPositions[i].x;
            ghost.y = ghostStartPositions[i].y;
            ghost.dir = i === 0 ? DIR.LEFT : DIR.UP;
            ghost.frightened = false;
            ghost.eaten = false;
            ghost.inHouse = i > 0;
            ghost.releaseTimer = config.ghostDelay[i] * 1000;
        });

        this.pause();
        setTimeout(() => this.resume(), 1500);
    }

    _nivelCompleto() {
        this.stop();
        this.score += 1000;
        if (this.onScoreChange) this.onScoreChange(this.score);

        if (this.level >= LEVEL_CONFIG.length) {
            if (this.onGameOver) this.onGameOver(this.score, this.level, true);
        } else {
            if (this.onLevelComplete) this.onLevelComplete(this.level, this.score);
        }
    }

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

    setPartnerDirection(dirName) {
        const dirMap = { 'up': DIR.UP, 'down': DIR.DOWN, 'left': DIR.LEFT, 'right': DIR.RIGHT };
        const d = dirMap[dirName];
        if (d) {
            this.pacman2.nextDir = d;
        }
    }

    // ==================== RENDERIZADO ====================

    _render() {
        const ctx = this.ctx;
        const ts = this.tileSize;

        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

        this.ghosts.forEach((ghost) => {
            this._drawGhost(ctx, ghost, ts);
        });

        // Dibujar ambos Pac-Men
        this._drawPacmanChar(ctx, this.pacman, ts, 'P1');
        this._drawPacmanChar(ctx, this.pacman2, ts, 'P2');
    }

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

    _drawRosquilla(ctx, cx, cy, radius, isPower) {
        const time = performance.now();

        if (isPower) {
            const pulse = 1 + Math.sin(time / 200) * 0.2;
            radius *= pulse;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isPower ? '#FFD700' : '#D4842A';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a1a';
        ctx.fill();

        if (isPower) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.fill();
        }
    }

    // Dibujar cualquier Pac-Man con sus colores propios y etiqueta
    _drawPacmanChar(ctx, pac, ts, label) {
        const cx = pac.x * ts + ts / 2;
        const cy = pac.y * ts + ts / 2;
        const radius = ts * 0.42;
        const mouth = pac.mouthAngle;

        let angle = 0;
        const d = pac.dir;
        if (d === DIR.RIGHT) angle = 0;
        else if (d === DIR.DOWN) angle = Math.PI / 2;
        else if (d === DIR.LEFT) angle = Math.PI;
        else if (d === DIR.UP) angle = -Math.PI / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.arc(0, 0, radius, mouth * 0.8, -mouth * 0.8 + Math.PI * 2);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = pac.bodyColor;
        ctx.fill();
        ctx.strokeStyle = pac.strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const eyeX = radius * 0.2;
        const eyeY = -radius * 0.4;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, radius * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

        ctx.restore();

        this._drawHat(ctx, cx, cy - radius * 0.7, ts, pac.hatColor);

        // Etiqueta flotante encima del Pac-Man
        if (label) {
            ctx.font = `bold ${Math.max(10, ts * 0.35)}px Fredoka One, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = pac.bodyColor;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(label, cx, cy - ts * 0.75);
            ctx.fillText(label, cx, cy - ts * 0.75);
        }
    }

    _drawHat(ctx, cx, cy, ts, hatColor) {
        const w = ts * 0.55;
        const h = ts * 0.2;

        ctx.fillStyle = hatColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy + h * 0.3, w * 0.6, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = hatColor;
        ctx.fillRect(cx - w * 0.25, cy - h * 0.8, w * 0.5, h * 1.1);

        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - w * 0.27, cy + h * 0.05, w * 0.54, h * 0.2);
    }

    _drawGhost(ctx, ghost, ts) {
        const cx = ghost.x * ts + ts / 2;
        const cy = ghost.y * ts + ts / 2;
        const radius = ts * 0.4;

        let color = ghost.color;
        if (ghost.frightened) {
            color = '#2222DD';
            if (performance.now() % 400 < 200) {
                color = '#FFFFFF';
            }
        }
        if (ghost.eaten) {
            this._drawGhostEyes(ctx, cx, cy, radius);
            return;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - radius * 0.1, radius, Math.PI, 0, false);
        ctx.lineTo(cx + radius, cy + radius * 0.7);

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

        if (ghost.frightened) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cx - radius * 0.25, cy - radius * 0.15, radius * 0.18, 0, Math.PI * 2);
            ctx.arc(cx + radius * 0.25, cy - radius * 0.15, radius * 0.18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            this._drawGhostEyes(ctx, cx, cy, radius);
        }
    }

    _drawGhostEyes(ctx, cx, cy, radius) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(cx - radius * 0.28, cy - radius * 0.15, radius * 0.2, radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + radius * 0.28, cy - radius * 0.15, radius * 0.2, radius * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupilas miran al Pac-Man más cercano
        const nearest = this._nearestPacman(cx / this.tileSize, cy / this.tileSize);
        const dx = nearest.x - cx / this.tileSize;
        const dy = nearest.y - cy / this.tileSize;
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

    // ==================== ESTADO SERIALIZABLE (multijugador) ====================

    getState() {
        return {
            p1: this._serializePac(this.pacman),
            p2: this._serializePac(this.pacman2),
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

    _serializePac(pac) {
        return {
            x: Math.round(pac.x * 100) / 100,
            y: Math.round(pac.y * 100) / 100,
            d: this._dirToString(pac.dir),
            nd: this._dirToString(pac.nextDir),
            m: Math.round(pac.mouthAngle * 100) / 100
        };
    }

    applyState(state) {
        if (!state) return;

        if (state.p1) this._applyPacState(this.pacman, state.p1);
        if (state.p2) this._applyPacState(this.pacman2, state.p2);

        // Retrocompatibilidad con formato antiguo
        if (state.px !== undefined) {
            this.pacman.x = state.px;
            this.pacman.y = state.py;
            this.pacman.dir = this._stringToDir(state.pd);
            this.pacman.nextDir = this._stringToDir(state.pnd);
            this.pacman.mouthAngle = state.pm;
        }

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

    _applyPacState(pac, data) {
        pac.x = data.x;
        pac.y = data.y;
        pac.dir = this._stringToDir(data.d);
        pac.nextDir = this._stringToDir(data.nd);
        pac.mouthAngle = data.m;
    }

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
