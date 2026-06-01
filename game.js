// 1. 캔버스 및 UI 요소 초기화
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("scoreDisplay");
const livesDisplay = document.getElementById("livesDisplay");
const timeDisplay = document.getElementById("timeDisplay");
const stageNameDisplay = document.getElementById("stageNameDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const pauseBtn = document.getElementById("pauseBtn");
const pauseOverlay = document.getElementById("pause-overlay");

const mainScreen = document.getElementById("main-screen");
const mainStartBtn = document.getElementById("mainStartBtn");
const mainTitle = document.getElementById("mainTitle");
const mainDesc = document.getElementById("mainDesc");

const ballColorSelect = document.getElementById("ball-color");
const paddleColorSelect = document.getElementById("paddle-color");
const bgmVolumeSlider = document.getElementById("bgm-volume");
const gameModeSelect = document.getElementById("game-mode");
const mainGameModeSelect = document.getElementById("main-game-mode");
const gameContainer = document.getElementById("game-container");
const uiPanel = document.getElementById("ui-panel");

// 일시정지 메뉴 버튼
const resumeBtn = document.getElementById("resumeBtn");
const restartStageBtn = document.getElementById("restartStageBtn");
const settingsBtn = document.getElementById("settingsBtn");
const goToMainBtn = document.getElementById("goToMainBtn");
const settingsOverlay = document.getElementById("settings-overlay");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

// 마법소녀 이미지 로드 및 배경 투명화 처리
const magicalGirlImg = new Image();
let processedImg = null;

magicalGirlImg.onload = () => {
    try {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = magicalGirlImg.width;
        tempCanvas.height = magicalGirlImg.height;
        const tCtx = tempCanvas.getContext("2d");
        tCtx.drawImage(magicalGirlImg, 0, 0);

        const imgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;
        // 흰색에 가까운 배경을 투명하게 처리
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
                data[i + 3] = 0; // alpha 값을 0으로
            }
        }
        tCtx.putImageData(imgData, 0, 0);

        processedImg = new Image();
        processedImg.src = tempCanvas.toDataURL();
    } catch (e) {
        // 로컬 파일 실행 시 CORS 에러 대비 (원본 그대로 사용)
        processedImg = magicalGirlImg;
    }
};
magicalGirlImg.src = "magical_girl.png";

// 2. 게임 상태 변수
let isDevMode = true;
let isGameRunning = false;
let isPaused = false;
let animationId;
let score = 0;
let lives = 10;
let currentStageIndex = 0;

// 최고 도달 스테이지 로드 (로컬 스토리지)
let maxUnlockedStage = parseInt(localStorage.getItem('maxUnlockedStage')) || 0;

// 타이머 변수
let timeLeft = 60;
let lastTime = 0;
let stageBaseScore = 0; // 스테이지별 획득 점수(등급 계산용)

// 고정 속력 상수 (기존 3, 3 기준 유클리드 속력 = 약 4.24)
const BASE_SPEED = Math.sqrt(3 * 3 + 3 * 3);

const paddle = {
    height: 15,
    width: 150,
    x: (canvas.width - 150) / 2,
    y: canvas.height - 80,
    color: "#ff69b4"
};

const ball = {
    x: canvas.width / 2,
    y: paddle.y - 150,
    dx: 3,
    dy: -3,
    radius: 10,
    color: ballColorSelect ? ballColorSelect.value : "red",
    isRespawning: false,
    respawnTimer: 0
};

let bricks = [];
let boss = null;

// 벽돌 기본 설정
const brickWidth = 75;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 50;
const brickOffsetLeft = 20;

// 3. 스테이지 데이터 정의
const stages = [
    {
        time: "08:00",
        name: "지하철(등굣길)",
        desc: "지하철 1호선의 인파를 뚫고 등교하자!",
        bgColor: "#e0e0e0",
        init: () => {
            bricks = [];
            boss = null;
            paddle.width = 150;
            const rowCount = isDevMode ? 2 : 5;
            const colCount = isDevMode ? 5 : 9;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    let hp = (r === 0) && (c % 2 === 0) ? 2 : 1;
                    bricks[c][r] = { x: 0, y: 0, status: hp, hp: hp, type: 'passenger', offsetX: 0 };
                }
            }
        },
        update: () => { },
        isCleared: () => checkAllBricksCleared()
    },
    {
        time: "10:00",
        name: "교수님의 지루한 수업",
        desc: "수마를 이겨내고 강의를 듣자!",
        bgColor: "#f0f8ff",
        init: () => {
            bricks = [];
            boss = null;
            paddle.width = 150;
            const rowCount = isDevMode ? 2 : 6;
            const colCount = isDevMode ? 4 : 8;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: 'sleepy', offsetX: 0 };
                }
            }
        },
        update: () => { },
        isCleared: () => checkAllBricksCleared()
    },
    {
        time: "12:00",
        name: "점심 보상 스테이지 (학식)",
        desc: "바닥에 닿아도 무적! 점수를 쓸어담자!",
        bgColor: "#fffacd",
        init: () => {
            bricks = [];
            boss = null;
            paddle.width = 250;
            const rowCount = isDevMode ? 1 : 4;
            const colCount = isDevMode ? 5 : 9;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: 'food', offsetX: 0 };
                }
            }
        },
        update: () => { },
        isCleared: () => checkAllBricksCleared()
    },
    {
        time: "17:00",
        name: "조별과제",
        desc: "무임승차하는 트롤 조원들을 타격하자!",
        bgColor: "#ffe4e1",
        init: () => {
            bricks = [];
            boss = null;
            paddle.width = 150;
            const rowCount = isDevMode ? 2 : 5;
            const colCount = isDevMode ? 5 : 9;
            const trollProb = isDevMode ? 0.3 : 0.6;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    let type = Math.random() < trollProb ? 'troll' : 'normal';
                    bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: type, offsetX: 0 };
                }
            }
        },
        update: () => {
            const time = Date.now() / 150;
            for (let c = 0; c < bricks.length; c++) {
                for (let r = 0; r < bricks[c].length; r++) {
                    let b = bricks[c][r];
                    if (b && b.status > 0 && b.type === 'troll') {
                        b.offsetX = Math.sin(time + c + r) * 15;
                    }
                }
            }
        },
        isCleared: () => checkAllBricksCleared()
    },
    {
        time: "23:00",
        name: "과제 (버그 물리치기)",
        desc: "최종 과제! 에러 코드를 수정하고 세미콜론을 찾아라!",
        bgColor: "#1e1e1e",
        init: () => {
            bricks = [];
            paddle.width = 150;
            // 최종 보스 체력 유저 모드 시 상향
            let bossHp = isDevMode ? 20 : 50;
            boss = { phase: 1, active: false, hp: bossHp, maxHp: bossHp, x: canvas.width / 2, y: 150, radius: 40, dx: 3, dy: 1 };

            const rowCount = isDevMode ? 2 : 4;
            const colCount = isDevMode ? 3 : 6;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    let isBug = (r + c) % 2 === 0;
                    if (isBug) {
                        bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: 'bugcode', offsetX: 0 };
                    } else {
                        bricks[c][r] = { x: 0, y: 0, status: 0, hp: 0, type: 'empty', offsetX: 0 };
                    }
                }
            }
        },
        update: () => {
            if (boss.phase === 1 && checkAllBricksCleared()) {
                boss.phase = 2;
                boss.appearanceStartTime = Date.now();
                ball.dy = Math.abs(ball.dy);
            }

            if (boss.phase === 2) {
                const elapsed = Date.now() - boss.appearanceStartTime;
                if (elapsed > 3000) {
                    boss.phase = 3;
                    boss.active = true;
                    ball.dy = -Math.abs(ball.dy);
                }
            }

            if (boss.active && boss.phase === 3) {
                boss.x += boss.dx;
                if (boss.x > canvas.width - boss.radius || boss.x < boss.radius) boss.dx *= -1;
            }
        },
        isCleared: () => boss && boss.phase === 3 && boss.hp <= 0
    }
];

function checkAllBricksCleared() {
    for (let c = 0; c < bricks.length; c++) {
        for (let r = 0; r < bricks[c].length; r++) {
            if (bricks[c][r] && bricks[c][r].status > 0) return false;
        }
    }
    return true;
}

// 등급(학점) 산출 함수
function getGrade(earnedScore) {
    if (earnedScore >= 600) return 'A+';
    if (earnedScore >= 500) return 'A';
    if (earnedScore >= 350) return 'B';
    if (earnedScore >= 200) return 'C';
    if (earnedScore >= 100) return 'D';
    return 'F';
}

// 4. 이벤트 리스너
document.addEventListener("mousemove", mouseMoveHandler, false);

function mouseMoveHandler(e) {
    if (isPaused) return; // 일시정지 중 조작 방지
    if (ball.isRespawning) return; // 공이 깜빡이는 동안 바 움직임 고정
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const relativeX = (e.clientX - rect.left) * scaleX;

    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
    }
}

// 일시정지 로직
function togglePause() {
    if (!isGameRunning) return;
    isPaused = !isPaused;

    if (isPaused) {
        if (pauseOverlay) pauseOverlay.style.display = "flex";
    } else {
        if (pauseOverlay) pauseOverlay.style.display = "none";
        lastTime = Date.now(); // 일시정지 해제 시 타이머 시간차 점프 방지
        draw();
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
    }
});

if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

if (resumeBtn) resumeBtn.addEventListener("click", togglePause);
if (restartStageBtn) restartStageBtn.addEventListener("click", () => {
    startGame(currentStageIndex);
});
if (settingsBtn) settingsBtn.addEventListener("click", () => {
    if (pauseOverlay) pauseOverlay.style.display = "none";
    if (settingsOverlay) settingsOverlay.style.display = "flex";
});
if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", () => {
    if (settingsOverlay) settingsOverlay.style.display = "none";
    if (pauseOverlay) pauseOverlay.style.display = "flex";
});
if (goToMainBtn) goToMainBtn.addEventListener("click", () => {
    cancelAnimationFrame(animationId);
    isGameRunning = false;
    isPaused = false;
    currentStageIndex = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showMainScreen("컴공생 마법소녀의 하루", "버그를 물리치고 무사히 과제를 제출하세요!", "menu");
});

if (mainStartBtn) mainStartBtn.addEventListener("click", () => {
    if (mainStartBtn.innerText === "메인 화면으로 돌아가기") {
        showMainScreen("컴공생 마법소녀의 하루", "버그를 물리치고 무사히 과제를 제출하세요!", "menu");
    } else if (mainStartBtn.innerText === "게임 시작") {
        startGame(0); // 첫 화면에서는 1교시(인덱스 0)부터 시작하며 상태 초기화
    } else {
        startGame(-1); // '다음으로' 버튼 (상태 유지)
    }
});

if (ballColorSelect) ballColorSelect.addEventListener("change", (e) => ball.color = e.target.value);
if (paddleColorSelect) paddleColorSelect.addEventListener("change", (e) => paddle.color = e.target.value);

function updateGameMode(mode) {
    isDevMode = (mode === 'dev');
    if (gameModeSelect && gameModeSelect.value !== mode) gameModeSelect.value = mode;
    if (mainGameModeSelect && mainGameModeSelect.value !== mode) mainGameModeSelect.value = mode;
}

if (gameModeSelect) gameModeSelect.addEventListener("change", (e) => updateGameMode(e.target.value));
if (mainGameModeSelect) mainGameModeSelect.addEventListener("change", (e) => updateGameMode(e.target.value));

if (bgmVolumeSlider) bgmVolumeSlider.addEventListener("input", (e) => {
    const volume = e.target.value;
    // 추후 배경음악이 추가되면 아래 코드를 통해 볼륨을 조절할 수 있습니다.
    // if(bgmAudio) bgmAudio.volume = volume / 100;
    console.log("BGM 볼륨 설정:", volume);
});

function startGame(stageIndex = -1) {
    if (pauseOverlay) pauseOverlay.style.display = "none";
    mainScreen.style.display = "none";
    if (uiPanel) uiPanel.style.display = "flex";

    if (stageIndex !== -1) {
        currentStageIndex = stageIndex;
        lives = 3;
        if (livesDisplay) livesDisplay.innerText = lives;
        score = 0;
        if (scoreDisplay) scoreDisplay.innerText = score;
    }

    initStage(currentStageIndex);
    isGameRunning = true;
    isPaused = false;
    lastTime = Date.now();
    draw();
}

// 5. 스테이지 초기화
function initStage(index) {
    if (index >= stages.length) {
        alert("모든 일과를 마쳤습니다! 과제 제출 성공! (A+)");
        isGameRunning = false;
        cancelAnimationFrame(animationId);
        showMainScreen("A+ 학점 달성!", "수고하셨습니다. 완벽한 하루였습니다.", "return");
        currentStageIndex = 0;
        return;
    }

    const stage = stages[index];
    if (timeDisplay) timeDisplay.innerText = stage.time;
    if (stageNameDisplay) stageNameDisplay.innerText = stage.name;
    gameContainer.style.backgroundColor = stage.bgColor;

    ball.x = canvas.width / 2;
    ball.y = paddle.y - 150; // 공이 더 높은 곳에서 생성되도록 수정
    ball.dx = 0;
    ball.dy = 0;
    ball.color = ballColorSelect ? ballColorSelect.value : "red";
    ball.isRespawning = true;
    ball.respawnTimer = Date.now();

    paddle.x = (canvas.width - paddle.width) / 2;

    score = 0;
    if (scoreDisplay) scoreDisplay.innerText = score;
    stageBaseScore = 0;

    timeLeft = 60; // 타이머 리셋
    if (timerDisplay) timerDisplay.innerText = timeLeft;

    stage.init();
}

function drawPixelBlock(ctx, x, y, w, h, baseColor) {
    // 검은색 외곽선
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);

    // 내부 베이스 색상
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // 하이라이트 (좌상단 베벨)
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(x + 2, y + 2, w - 4, 3); // top
    ctx.fillRect(x + 2, y + 2, 3, h - 4); // left

    // 섀도우 (우하단 베벨)
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(x + 2, y + h - 5, w - 4, 3); // bottom
    ctx.fillRect(x + w - 5, y + 2, 3, h - 4); // right
}

// 6. 그리기 로직
function drawBall() {
    const size = ball.radius * 2;
    const px = ball.x - ball.radius;
    const py = ball.y - ball.radius;

    if (ball.isRespawning) {
        // 깜빡임 효과 (150ms 간격으로 on/off)
        const elapsed = Date.now() - ball.respawnTimer;
        if (Math.floor(elapsed / 150) % 2 === 0) {
            drawPixelBlock(ctx, px, py, size, size, ball.color);
        }

        // 1초(1000ms) 대기 후 발사
        if (elapsed > 1000) {
            ball.isRespawning = false;
            ball.dx = 0; // 곧바로 아래로 떨어지게 설정
            ball.dy = BASE_SPEED;
        }
    } else {
        drawPixelBlock(ctx, px, py, size, size, ball.color);
    }
}

function drawPaddle() {
    // 패들 아래에 마법소녀를 배치
    if (processedImg && processedImg.complete && processedImg.naturalWidth !== 0) {
        const imgW = 90;
        const imgH = 90;
        ctx.drawImage(processedImg, paddle.x + paddle.width / 2 - imgW / 2, paddle.y + 15, imgW, imgH);
    }

    drawPixelBlock(ctx, paddle.x, paddle.y, paddle.width, paddle.height, paddle.color);
}

function drawBricks() {
    const stage = stages[currentStageIndex];

    if (currentStageIndex === 4) {
        ctx.fillStyle = "rgba(78, 201, 176, 0.3)";
        ctx.font = "16px Consolas, monospace";
        const codeLines = [
            "function doAssignment() {",
            "    const target = 'A+';",
            "    let sleep = 0;",
            "    while (bugCount > 0) {",
            "        fixBug();",
            "        coffee.drink();",
            "        if (energy < 10) throw new Error('Burnout');",
            "    }",
            "    return submitToProfessor();",
            "}",
            "",
            "async function fixBug() {",
            "    await stackOverflow.search('TypeError');",
            "    const solution = copyAndPaste();",
            "    if (!solution.works) {",
            "        console.error('Why is this not working!?');",
            "        // FIXME: please work",
            "    }",
            "}",
            "// ... more complex logic ...",
            "module.exports = doAssignment;"
        ];

        for (let i = 0; i < codeLines.length; i++) {
            // 왼쪽 열
            ctx.fillText(codeLines[i], 20, 30 + i * 25);
            // 가운데 열
            ctx.fillText(codeLines[i], 320, 30 + i * 25);
            // 오른쪽 열
            ctx.fillText(codeLines[i], 620, 30 + i * 25);
        }
    }

    for (let c = 0; c < bricks.length; c++) {
        for (let r = 0; r < bricks[c].length; r++) {
            let b = bricks[c][r];
            if (b && b.status > 0) {
                let bw = brickWidth;
                let bh = brickHeight;
                let bx = (c * (bw + brickPadding)) + brickOffsetLeft + (b.offsetX || 0);
                let by = (r * (bh + brickPadding)) + brickOffsetTop;

                if (currentStageIndex === 4) {
                    bx = (c * (110)) + 60;
                    by = (r * (50)) + 60;
                }

                b.x = bx;
                b.y = by;

                if (b.type === 'bugcode') {
                    ctx.beginPath();
                    ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                    ctx.fillRect(bx, by, bw, bh);
                    ctx.fillStyle = "#f14c4c";
                    ctx.font = "14px Consolas";
                    ctx.fillText("Uncaught TypeError", bx, by + 15);
                    ctx.strokeStyle = "red";
                    ctx.beginPath();
                    ctx.setLineDash([4, 2]);
                    ctx.moveTo(bx, by + bh);
                    ctx.lineTo(bx + bw, by + bh);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.closePath();
                } else if (b.type === 'food') {
                    drawPixelBlock(ctx, bx, by, bw, bh, "#ffb6c1");
                } else if (b.type === 'troll') {
                    drawPixelBlock(ctx, bx, by, bw, bh, "#8a2be2");
                } else {
                    let color = b.hp === 2 ? "#555555" : "#FF5733";
                    drawPixelBlock(ctx, bx, by, bw, bh, color);
                }
            }
        }
    }
}

function drawBoss() {
    if (!boss) return;

    if (boss.phase === 2) {
        const elapsed = Date.now() - boss.appearanceStartTime;

        ctx.save();
        const shakeX = (Math.random() - 0.5) * 10;
        const shakeY = (Math.random() - 0.5) * 10;
        ctx.translate(shakeX, shakeY);

        ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
        ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

        if (Math.floor(elapsed / 200) % 2 === 0) {
            ctx.fillStyle = "#ff0000";
            ctx.font = "bold 40px Consolas";
            ctx.textAlign = "center";
            ctx.fillText("! WARNING !", canvas.width / 2, canvas.height / 2 - 30);
            ctx.font = "bold 24px Consolas";
            ctx.fillText("FATAL ERROR: MISSING SEMICOLON", canvas.width / 2, canvas.height / 2 + 10);
            ctx.textAlign = "left";
        }
        ctx.restore();
    } else if (boss.active && boss.phase === 3) {
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 80px Consolas";
        ctx.fillText(";", boss.x - 20, boss.y + 30);

        // 레트로 픽셀 HP 바
        ctx.fillStyle = "#000";
        ctx.fillRect(boss.x - 42, boss.y - 52, 84, 14);
        ctx.fillStyle = "white";
        ctx.fillRect(boss.x - 40, boss.y - 50, 80, 10);
        ctx.fillStyle = "red";
        ctx.fillRect(boss.x - 40, boss.y - 50, Math.max(0, boss.hp / (boss.maxHp || 20)) * 80, 10);
    }
}

// 7. 충돌 감지
function collisionDetection() {
    const stage = stages[currentStageIndex];

    for (let c = 0; c < bricks.length; c++) {
        for (let r = 0; r < bricks[c].length; r++) {
            let b = bricks[c][r];
            if (b && b.status > 0) {
                let bw = brickWidth;
                let bh = brickHeight;

                // 원형-사각형 최단 거리(Closest Point) 계산
                let testX = ball.x;
                let testY = ball.y;

                if (ball.x < b.x) testX = b.x;
                else if (ball.x > b.x + bw) testX = b.x + bw;

                if (ball.y < b.y) testY = b.y;
                else if (ball.y > b.y + bh) testY = b.y + bh;

                let distX = ball.x - testX;
                let distY = ball.y - testY;
                let distance = Math.sqrt((distX * distX) + (distY * distY));

                if (distance <= ball.radius) {
                    // 밀어내기 (Overlap resolution)
                    let overlap = ball.radius - distance;
                    if (distance > 0) {
                        ball.x += (distX / distance) * overlap;
                        ball.y += (distY / distance) * overlap;

                        // 벡터 반사
                        let nx = distX / distance;
                        let ny = distY / distance;
                        let dot = ball.dx * nx + ball.dy * ny;
                        if (dot < 0) { // 공이 벽돌을 향해 이동 중일 때만 반사
                            ball.dx -= 2 * dot * nx;
                            ball.dy -= 2 * dot * ny;
                        }
                    } else {
                        // 공의 중심이 블록 모서리 내부에 완벽히 겹쳤을 때의 예외 처리
                        ball.y -= overlap;
                        ball.dy = -Math.abs(ball.dy);
                    }

                    b.hp--;
                    b.status = b.hp;

                    if (b.hp <= 0) {
                        score += (b.type === 'food' ? 50 : 10);
                        if (scoreDisplay) scoreDisplay.innerText = score;
                    }
                }
            }
        }
    }

    if (boss && boss.active && boss.phase === 3) {
        let dx = ball.x - boss.x;
        let dy = ball.y - boss.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < ball.radius + boss.radius) {
            // 원형 보스와의 충돌 시 물리적 반사 및 겹침 밀어내기
            let overlap = (ball.radius + boss.radius) - distance;
            let nx = dx / distance;
            let ny = dy / distance;

            ball.x += nx * overlap;
            ball.y += ny * overlap;

            let dot = ball.dx * nx + ball.dy * ny;
            if (dot < 0) {
                ball.dx -= 2 * dot * nx;
                ball.dy -= 2 * dot * ny;

                const now = Date.now();
                // 200ms 단위로만 데미지 판정
                if (!boss.lastHitTime || now - boss.lastHitTime > 200) {
                    boss.hp--;
                    score += 10;
                    if (scoreDisplay) scoreDisplay.innerText = score;
                    boss.lastHitTime = now;
                }
            }
        }
    }

    if (stage.isCleared()) {
        isGameRunning = false;
        cancelAnimationFrame(animationId);

        let baseEarned = score - stageBaseScore;
        let timeBonus = timeLeft > 0 ? timeLeft * 10 : 0;
        score += timeBonus;
        if (scoreDisplay) scoreDisplay.innerText = score;

        let stageEarned = baseEarned + timeBonus;
        let grade = getGrade(stageEarned);

        // 최고 기록 갱신 및 로컬 스토리지 저장
        if (currentStageIndex + 1 > maxUnlockedStage && currentStageIndex + 1 < stages.length) {
            maxUnlockedStage = currentStageIndex + 1;
            localStorage.setItem('maxUnlockedStage', maxUnlockedStage);
        }

        currentStageIndex++;
        if (currentStageIndex < stages.length) {
            showMainScreen(
                "스테이지 클리어!",
                `기본 스코어: ${baseEarned}\n시간 보너스: +${timeBonus}\n합산 스코어: ${stageEarned}\n이번 스테이지 등급: [ ${grade} ]\n\n${stages[currentStageIndex].time} 으로 이동합니다.`,
                "next"
            );
        } else {
            showMainScreen(
                "A+ 학점 달성!",
                `기본 스코어: ${baseEarned}\n시간 보너스: +${timeBonus}\n합산 스코어: ${stageEarned}\n최종 학점: [ ${grade} ]\n\n수고하셨습니다. 완벽한 하루였습니다.`,
                "return"
            );
            currentStageIndex = 0;
        }
    }
}

function renderStageSelect() {
    const container = document.getElementById("stage-select-container");
    if (!container) return;
    container.innerHTML = "";

    stages.forEach((stage, index) => {
        const btn = document.createElement("button");
        btn.className = "stage-btn";

        if (index <= maxUnlockedStage) {
            btn.innerText = `${index + 1}교시`;
            btn.addEventListener("click", () => {
                startGame(index);
            });
        } else {
            btn.innerText = `🔒 ${index + 1}교시`;
            btn.classList.add("locked");
        }

        container.appendChild(btn);
    });
}

function showMainScreen(title, desc, mode = "next") {
    if (pauseOverlay) pauseOverlay.style.display = "none";
    mainScreen.style.display = "flex";
    if (mainTitle) mainTitle.innerText = title;
    if (mainDesc) mainDesc.innerText = desc;

    const stageSelect = document.getElementById("stage-select-container");
    if (mode === "menu") {
        if (mainStartBtn) {
            mainStartBtn.style.display = "block";
            mainStartBtn.innerText = "게임 시작";
        }
        if (stageSelect) {
            stageSelect.style.display = "flex";
            renderStageSelect();
        }
    } else {
        if (mainStartBtn) {
            mainStartBtn.style.display = "block";
            if (mode === "next") {
                mainStartBtn.innerText = "다음으로";
            } else if (mode === "return") {
                mainStartBtn.innerText = "메인 화면으로 돌아가기";
            }
        }
        if (stageSelect) stageSelect.style.display = "none";
    }

    // UI 패널 표시 여부
    if (mode === "menu" || mode === "return") {
        if (uiPanel) uiPanel.style.display = "none";
    }
} // 8. 메인 게임 루프
function draw() {
    if (!isGameRunning || isPaused) return;

    // 0. 타이머 및 스테이지 업데이트 처리
    const now = Date.now();
    if (now - lastTime >= 1000) {
        if (timeLeft > 0) {
            timeLeft--;
            if (timerDisplay) timerDisplay.innerText = timeLeft;
        }
        lastTime = now;
    }

    if (stages[currentStageIndex].update) {
        stages[currentStageIndex].update();
    }

    // 1. 공 위치 이동
    if (!ball.isRespawning) {
        ball.x += ball.dx;
        ball.y += ball.dy;
    }

    // 2. 화면 경계(벽) 충돌 정밀 처리 (Clamp)
    if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.dx = Math.abs(ball.dx);
    } else if (ball.x > canvas.width - ball.radius) {
        ball.x = canvas.width - ball.radius;
        ball.dx = -Math.abs(ball.dx);
    }

    if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.dy = Math.abs(ball.dy);
    } else if (ball.y > canvas.height - ball.radius) {
        if (currentStageIndex === 2) {
            // 바닥에 튕기는 특수 스테이지
            ball.y = canvas.height - ball.radius;
            ball.dy = -Math.abs(ball.dy);
        } else {
            // 바닥에 떨어짐 (목숨 감소 로직)
            lives--;
            if (livesDisplay) livesDisplay.innerText = lives;

            if (lives > 0) {
                paddle.x = (canvas.width - paddle.width) / 2; // 바 중앙 고정
                ball.x = canvas.width / 2;
                ball.y = paddle.y - 150;
                ball.dx = 0;
                ball.dy = 0;
                ball.isRespawning = true;
                ball.respawnTimer = Date.now();
            } else {
                isGameRunning = false;
                cancelAnimationFrame(animationId);
                showMainScreen("게임 오버", "다시 도전해보세요!", "return");
                currentStageIndex = 0;
                return;
            }
        }
    }

    // 3. 패들 충돌 정밀 처리 (Circle-AABB)
    let testX = ball.x;
    let testY = ball.y;

    if (ball.x < paddle.x) testX = paddle.x;
    else if (ball.x > paddle.x + paddle.width) testX = paddle.x + paddle.width;

    if (ball.y < paddle.y) testY = paddle.y;
    else if (ball.y > paddle.y + paddle.height) testY = paddle.y + paddle.height;

    let distX = ball.x - testX;
    let distY = ball.y - testY;
    let distance = Math.sqrt((distX * distX) + (distY * distY));

    if (distance <= ball.radius && !ball.isRespawning) {
        let overlap = ball.radius - distance;
        if (distance > 0) {
            ball.x += (distX / distance) * overlap;
            ball.y += (distY / distance) * overlap;
        }

        // 어디에 부딪혔는지 판별
        if (testY === paddle.y) {
            // 윗면 충돌 (유도탄 앵글 적용)
            let hitPoint = ball.x - (paddle.x + paddle.width / 2);
            let normalizedHitPoint = hitPoint / (paddle.width / 2);
            let bounceAngle = normalizedHitPoint * (Math.PI / 3);
            ball.dx = BASE_SPEED * Math.sin(bounceAngle);
            ball.dy = -Math.abs(BASE_SPEED * Math.cos(bounceAngle));
        } else {
            // 옆면 혹은 아랫면 충돌
            if (testX === paddle.x || testX === paddle.x + paddle.width) {
                ball.dx = -ball.dx;
            } else {
                ball.dy = Math.abs(ball.dy); // 아랫면을 때리면 아래로 튕김
            }
        }
    }

    // 4. 화면 그리기 및 기타 객체 충돌 (벽돌, 보스)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBricks();
    drawBoss();
    drawPaddle();
    drawBall();

    collisionDetection();

    animationId = requestAnimationFrame(draw);
}

// 초기 화면 설정 (최초 로드 시 스테이지 선택 버튼 생성 및 게임 시작 버튼 표시)
showMainScreen("컴공생 마법소녀의 하루", "버그를 물리치고 무사히 과제를 제출하세요!", "menu");