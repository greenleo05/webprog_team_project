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

const helpOverlay = document.getElementById("help-overlay");
const helpBtn = document.getElementById("helpBtn");
const closeHelpBtn = document.getElementById("closeHelpBtn");

const cutsceneOverlay = document.getElementById("cutscene-overlay");
const cutsceneText = document.getElementById("cutscene-text");

const stageComments = [
    "오늘도 어김없이 지옥철...\n그래도 1교시는 포기할 수 없지!",
    "힘든 지하철을 뚫고 수업에 들어왔는데 졸음이 몰려온다...\n안 돼, 버텨야 해!",
    "드디어 꿀맛 같은 점심시간!\n메뉴는 뭘까?",
    "왜 항상 조별과제는 나 혼자 하는 기분일까...\n제발 다들 참여 좀 해!",
    "최종 보스, 과제 제출.\n여기서 무너지면 내 학점도 무너진다!"
];

let cutsceneTimerId = null;
let isCutscenePlaying = false;

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
        processedImg = magicalGirlImg;
    }
};
magicalGirlImg.src = "magical_girl.png";

const magicalBeamImg = new Image();
magicalBeamImg.src = "magical_beam.png";

const loadedDesignImages = {};
const designImageFiles = ["paddle_ex_design.png", "ball_yellow.png", "ball_green.png", "ball_red.png", "ball_blue.png"];
designImageFiles.forEach(src => {
    const img = new Image();
    img.src = src;
    loadedDesignImages[src] = img;
});

// 2. 게임 상태 변수
let isDevMode = false;
let isGameRunning = false;
let isPaused = false;
let animationId;
let score = 0;
let lives = 10;
let currentStageIndex = 0;
let savedLivesAtStageStart = 3;
let savedScoreAtStageStart = 0;

// 최고 도달 스테이지 로드 (로컬 스토리지)
let maxUnlockedStage = parseInt(localStorage.getItem('maxUnlockedStage')) || 0;

// 타이머 변수
let timeLeft = 60;
let lastTime = 0;
let stageBaseScore = 0; // 스테이지별 획득 점수(등급 계산용)

// 고정 속력 상수
const BASE_SPEED = 1

const paddle = {
    height: 15,
    width: 150,
    x: (canvas.width - 150) / 2,
    y: canvas.height - 80,
    color: "paddle_ex_design.png",
    debuffTimer: 0
};

let balls = [];
let items = [];
let projectiles = [];
let meteors = [];
let ultimateGauge = 0;
const MAX_GAUGE = 100;
let blackhole = null;
let ultimateBgAlpha = 0;

function createBall(x, y, dx, dy, isRespawning = false) {
    return {
        x: x,
        y: y,
        dx: dx,
        dy: dy,
        radius: 15,
        color: ballColorSelect ? ballColorSelect.value : "ball_red.png",
        isRespawning: isRespawning,
        respawnTimer: isRespawning ? Date.now() : 0
    };
}

let bricks = [];
let boss = null;
let particles = [];

const profQuotes = [
    "display:flex",
    "addEventListener",
    "forEach",
    "await fetch()"
];

const teamQuotes = [
    "저 오늘 회의에 못 갈 것 같습니다ㅠㅠ",
    "자료조사.txt 출처 나무위키",
    "아 그거 깜빡했는데 어떡하죠?",
    "아... 내일까지라고요?"
];

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
                    let isTroll = Math.random() < 0.15;
                    let hp = isTroll ? 2 : 1;
                    let type = isTroll ? 'troll_hard' : 'passenger';
                    bricks[c][r] = { x: 0, y: 0, status: hp, hp: hp, type: type, offsetX: 0 };
                }
            }
        },
        update: () => { },
        isCleared: () => checkAllBricksCleared()
    },
    {
        time: "10:00",
        name: "교수님의 즐거운 수업",
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
                    let isTroll = Math.random() < 0.15;
                    let hp = isTroll ? 3 : 1;
                    let type = isTroll ? 'troll_hard' : 'sleepy';
                    let quote = profQuotes[Math.floor(Math.random() * profQuotes.length)];
                    bricks[c][r] = { x: 0, y: 0, status: hp, hp: hp, type: type, offsetX: 0, text: quote };
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
                    const foods = ['food_sandwich', 'food_cake', 'food_drink', 'food_orange'];
                    let type = foods[Math.floor(Math.random() * foods.length)];
                    bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: type, offsetX: 0 };
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
            const trollProb = isDevMode ? 0.1 : 0.2;
            let hasTroll = false;
            for (let c = 0; c < colCount; c++) {
                bricks[c] = [];
                for (let r = 0; r < rowCount; r++) {
                    let type = Math.random() < trollProb ? 'troll' : 'normal';
                    if (type === 'troll') hasTroll = true;
                    let quote = teamQuotes[Math.floor(Math.random() * teamQuotes.length)];
                    // 카톡 배치: 짝수행은 왼쪽, 홀수행은 오른쪽
                    let isRight = r % 2 !== 0;
                    // 블록 너비가 넓어지므로 그리기 시에 위치를 참조할 플래그
                    bricks[c][r] = { x: 0, y: 0, status: 1, hp: 1, type: type, offsetX: 0, text: quote, isRight: isRight };
                }
            }
            if (!hasTroll && colCount > 0 && rowCount > 0) {
                let rc = Math.floor(Math.random() * colCount);
                let rr = Math.floor(Math.random() * rowCount);
                bricks[rc][rr].type = 'troll';
            }
        },
        update: () => {
            const time = Date.now() / 150;
            for (let c = 0; c < bricks.length; c++) {
                for (let r = 0; r < bricks[c].length; r++) {
                    let b = bricks[c][r];
                    if (b && b.status > 0) {
                        if (b.type === 'troll') {
                            b.dropY = (b.dropY || 0) + 0.2; // 서서히 아래로 하강
                            b.offsetX = Math.sin(time * 2 + c) * 20; // 격렬한 좌우 진동
                            b.offsetY = Math.cos(time * 2 + r) * 10 + b.dropY;

                            // 패들 라인에 닿으면 점수 페널티 후 파괴
                            let bw = b.w || 200;
                            let bh = b.h || 30;
                            if (b.y && b.y + bh >= paddle.y && b.y <= paddle.y + paddle.height &&
                                b.x + bw >= paddle.x && b.x <= paddle.x + paddle.width) {
                                b.status = 0;
                                score -= 500; // 패들에 닿으면 점수 페널티
                                if (score < 0) score = 0;
                                if (scoreDisplay) scoreDisplay.innerText = score;
                                // 터지는 이펙트
                                for (let i = 0; i < 15; i++) {
                                    particles.push({
                                        x: b.x + bw / 2, y: b.y + bh / 2,
                                        dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10,
                                        life: 30, color: "#ff0000"
                                    });
                                }
                            } else if (b.y && b.y > canvas.height) {
                                b.status = 0; // 화면 밖으로 나가면 파괴
                            }
                        } else {
                            // 일반 블록은 둥둥 떠다님
                            b.offsetX = Math.sin(time * 0.5 + c) * 10;
                            b.offsetY = Math.cos(time * 0.5 + r) * 10;
                        }
                    }
                }
            }
        },
        isCleared: () => checkAllBricksCleared(['troll'])
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
                balls.forEach(b => { if (!b.isRespawning) b.dy = Math.abs(b.dy); });
            }

            if (boss.phase === 2) {
                const elapsed = Date.now() - boss.appearanceStartTime;
                if (elapsed > 3000) {
                    boss.phase = 3;
                    boss.active = true;
                    boss.lastItemDrop = Date.now();
                    boss.lastProjectile = Date.now();
                    balls.forEach(b => { if (!b.isRespawning) b.dy = -Math.abs(b.dy); });
                }
            }

            if (boss.active && boss.phase === 3) {
                boss.x += boss.dx;
                if (boss.x > canvas.width - boss.radius || boss.x < boss.radius) boss.dx *= -1;

                const now = Date.now();
                // 1. 아이템 드랍 (8초)
                if (now - boss.lastItemDrop > 8000) {
                    items.push({ x: boss.x, y: boss.y, dy: 2, radius: 15 });
                    boss.lastItemDrop = now;
                }

                // 2. 투사체(콩알탄) 패턴 (3초)
                if (now - boss.lastProjectile > 3000) {
                    if (Math.random() > 0.7) {
                        projectiles.push({
                            type: 'debuff',
                            x: boss.x, y: boss.y,
                            dx: 0, dy: 3,
                            radius: 15, text: "F"
                        });
                    } else {
                        let isDoubleQuote = Math.random() > 0.5;
                        projectiles.push({
                            type: 'quote',
                            x: boss.x + (Math.random() - 0.5) * 160, y: boss.y + 60 + Math.random() * 50,
                            dx: 0, dy: 0,
                            width: 70, height: 35, text: isDoubleQuote ? '""' : "''"
                        });
                    }
                    boss.lastProjectile = now;
                }

                // 3. 블랙홀 생성 (체력 50% 이하)
                if (boss.hp <= boss.maxHp / 2 && !blackhole) {
                    blackhole = { x: canvas.width / 2, y: canvas.height / 2 - 50, radius: 60, createdAt: now };
                }
            }
        },
        isCleared: () => boss && boss.phase === 3 && boss.hp <= 0
    }
];

function checkAllBricksCleared(ignoreTypes = []) {
    for (let c = 0; c < bricks.length; c++) {
        for (let r = 0; r < bricks[c].length; r++) {
            let b = bricks[c][r];
            if (b && b.status > 0 && !ignoreTypes.includes(b.type)) return false;
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
    if (balls.some(b => b.isRespawning)) return; // 공이 깜빡이는 동안 바 움직임 고정
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
        cancelAnimationFrame(animationId);
        draw();
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
    } else if (e.code === 'Space') {
        if (isGameRunning && !isPaused && ultimateGauge >= MAX_GAUGE) {
            ultimateGauge = 0;
            spawnMeteors();
        }
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

if (helpBtn) helpBtn.addEventListener("click", () => {
    if (helpOverlay) helpOverlay.style.display = "flex";
});

if (closeHelpBtn) closeHelpBtn.addEventListener("click", () => {
    if (helpOverlay) helpOverlay.style.display = "none";
});

if (ballColorSelect) ballColorSelect.addEventListener("change", (e) => {
    balls.forEach(b => b.color = e.target.value);
});
if (paddleColorSelect) paddleColorSelect.addEventListener("change", (e) => paddle.color = e.target.value);

function updateGameMode(mode) {
    isDevMode = (mode === 'dev');
    if (gameModeSelect && gameModeSelect.value !== mode) gameModeSelect.value = mode;
    if (mainGameModeSelect && mainGameModeSelect.value !== mode) mainGameModeSelect.value = mode;
    renderStageSelect();
    if (mainScreen.style.display !== "none" && mainStartBtn && mainStartBtn.innerText === "게임 시작") {
        mainStartBtn.style.display = isDevMode ? "block" : "none";
    }
}

if (gameModeSelect) gameModeSelect.addEventListener("change", (e) => updateGameMode(e.target.value));
if (mainGameModeSelect) mainGameModeSelect.addEventListener("change", (e) => updateGameMode(e.target.value));

let titleClickCount = 0;
let titleClickTimer = null;
if (mainTitle) {
    mainTitle.addEventListener("click", () => {
        titleClickCount++;
        clearTimeout(titleClickTimer);
        titleClickTimer = setTimeout(() => {
            titleClickCount = 0;
        }, 1000);

        if (titleClickCount >= 3) {
            titleClickCount = 0;
            updateGameMode(isDevMode ? 'user' : 'dev');
        }
    });
}

const bgmAudio = new Audio("background-music.wav");
bgmAudio.loop = true;
if (bgmVolumeSlider) {
    bgmAudio.volume = bgmVolumeSlider.value / 100;
    bgmVolumeSlider.addEventListener("input", (e) => {
        const volume = e.target.value;
        bgmAudio.volume = volume / 100;
        console.log("BGM 볼륨 설정:", volume);
    });
}

function startGame(stageIndex = -1) {
    if (bgmAudio && bgmAudio.paused) {
        bgmAudio.play().catch(e => console.log("Audio play failed:", e));
    }

    if (isCutscenePlaying) return;

    if (pauseOverlay) pauseOverlay.style.display = "none";
    mainScreen.style.display = "none";
    if (uiPanel) uiPanel.style.display = "flex";

    if (stageIndex !== -1) {
        currentStageIndex = stageIndex;
        if (stageIndex === 0) {
            lives = isDevMode ? 10 : 3;
            savedLivesAtStageStart = lives;
            score = 0;
            savedScoreAtStageStart = score;
        } else {
            lives = savedLivesAtStageStart;
            score = savedScoreAtStageStart;
        }
        if (livesDisplay) livesDisplay.innerText = lives;
        if (scoreDisplay) scoreDisplay.innerText = score;
        ultimateGauge = 0;
    } else {
        savedLivesAtStageStart = lives;
        savedScoreAtStageStart = score;
    }

    if (cutsceneOverlay && cutsceneText && currentStageIndex >= 0 && currentStageIndex < 5) {
        isCutscenePlaying = true;
        cutsceneOverlay.style.display = "flex";

        // 배경 이미지 설정 (pre_stage_1_bg.png ~ pre_stage_5_bg.png)
        cutsceneOverlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('pre_stage_${currentStageIndex + 1}_bg.png')`;
        cutsceneOverlay.style.backgroundSize = "cover";
        cutsceneOverlay.style.backgroundPosition = "center";

        cutsceneText.innerText = stageComments[currentStageIndex];

        cutsceneTimerId = setTimeout(() => {
            cutsceneOverlay.style.display = "none";
            isCutscenePlaying = false;
            cutsceneTimerId = null;

            initStage(currentStageIndex);
            isGameRunning = true;
            isPaused = false;
            lastTime = Date.now();
            cancelAnimationFrame(animationId);
            draw();
        }, 5000);
    } else {
        initStage(currentStageIndex);
        isGameRunning = true;
        isPaused = false;
        lastTime = Date.now();
        cancelAnimationFrame(animationId);
        draw();
    }
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

    if (index === 0) {
        // 투명도 레이어를 추가하여 벽돌이 잘 보이게 처리 (지하철)
        canvas.style.backgroundImage = "linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url('stage_0_bg.png')";
        canvas.style.backgroundSize = "cover";
        canvas.style.backgroundPosition = "center";
        canvas.style.border = "none";
        canvas.style.outline = "none";
        gameContainer.style.backgroundColor = "transparent";
    } else if (index === 1) {
        // 투명도 레이어를 추가하여 벽돌이 잘 보이게 처리 (강의실)
        canvas.style.backgroundImage = "linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url('stage_1_bg.png')";
        canvas.style.backgroundSize = "cover";
        canvas.style.backgroundPosition = "center";
        canvas.style.border = "none";
        canvas.style.outline = "none";
        gameContainer.style.backgroundColor = "transparent";
    } else if (index === 2) {
        // 투명도 레이어를 추가하여 벽돌이 잘 보이게 처리 (학식당)
        canvas.style.backgroundImage = "linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url('stage_2_1_bg.png')";
        canvas.style.backgroundSize = "cover";
        canvas.style.backgroundPosition = "center";
        canvas.style.border = "none";
        canvas.style.outline = "none";
        gameContainer.style.backgroundColor = "transparent";
    } else if (index === 3) {
        // 투명도 레이어를 추가하여 벽돌이 잘 보이게 처리 (조별과제 텅 빈 카톡방)
        canvas.style.backgroundImage = "linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url('stage_3_bg.png')";
        canvas.style.backgroundSize = "100% 100%"; // 화면 비율에 맞춰 늘리거나 줄여 잘림 방지
        canvas.style.backgroundPosition = "center";
        canvas.style.border = "none";
        canvas.style.outline = "none";
        gameContainer.style.backgroundColor = "transparent";
    } else if (index === 4) {
        // 픽셀 레트로 3D 프레임 느낌 적용 (현재 테마와 맞춤)
        canvas.style.backgroundImage = "none";
        canvas.style.borderStyle = "solid";
        canvas.style.borderWidth = "6px";
        canvas.style.borderTopColor = "#ffffff";
        canvas.style.borderLeftColor = "#ffffff";
        canvas.style.borderBottomColor = "#ffb6c1";
        canvas.style.borderRightColor = "#ffb6c1";
        canvas.style.outline = "4px solid #ff69b4";
        canvas.style.boxSizing = "border-box";
        gameContainer.style.backgroundColor = "#000000"; // 코드가 돋보이도록 검은 배경
    } else {
        canvas.style.backgroundImage = "none";
        canvas.style.border = "none";
        canvas.style.outline = "none";
        gameContainer.style.backgroundColor = stage.bgColor;
    }

    balls = [createBall(canvas.width / 2, paddle.y - 150, 0, 0, true)];
    items = [];
    projectiles = [];
    meteors = [];
    particles = [];
    blackhole = null;

    paddle.x = (canvas.width - paddle.width) / 2;
    paddle.debuffTimer = 0;

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
function drawBalls() {
    balls.forEach(ball => {
        const size = ball.radius * 2;
        const px = ball.x - ball.radius;
        const py = ball.y - ball.radius;

        const drawBallShape = () => {
            if (ball.color && ball.color.endsWith(".png")) {
                const img = loadedDesignImages[ball.color];
                if (img && img.complete && img.naturalWidth !== 0) {
                    const scale = 1.76;
                    const imgSize = size * scale;
                    const imgPx = ball.x - imgSize / 2;
                    const imgPy = ball.y - imgSize / 2;
                    ctx.drawImage(img, imgPx, imgPy, imgSize, imgSize);
                } else {
                    drawPixelBlock(ctx, px, py, size, size, "red");
                }
            } else {
                drawPixelBlock(ctx, px, py, size, size, ball.color || "red");
            }
        };

        if (ball.isRespawning) {
            const elapsed = Date.now() - ball.respawnTimer;
            if (Math.floor(elapsed / 150) % 2 === 0) {
                drawBallShape();
            }
            if (elapsed > 1000) {
                ball.isRespawning = false;
                ball.dx = 0;
                ball.dy = BASE_SPEED;
            }
        } else {
            drawBallShape();
        }
    });
}

function drawItems() {
    items.forEach(item => {
        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 20px Consolas";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("A+", item.x, item.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    });
}

function drawProjectiles() {
    projectiles.forEach(p => {
        if (p.type === 'debuff') {
            ctx.fillStyle = "#ff0000";
            ctx.font = "bold 24px Consolas";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.text, p.x, p.y);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
        } else if (p.type === 'quote') {
            let left = p.x - p.width / 2;
            let top = p.y - p.height / 2;
            let isDouble = p.text === '""';

            ctx.fillStyle = isDouble ? "#333333" : "#ffe4e1";
            ctx.fillRect(left, top, p.width, p.height);

            ctx.strokeStyle = isDouble ? "#ff0000" : "#ff69b4";
            ctx.lineWidth = 2;
            ctx.strokeRect(left, top, p.width, p.height);

            ctx.fillStyle = isDouble ? "#ff0000" : "#ff1493";
            ctx.font = "bold 20px Consolas";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(p.text, p.x, p.y);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
        }
    });
}

function spawnMeteors() {
    const count = 10;
    for (let i = 0; i < count; i++) {
        meteors.push({
            x: Math.random() * canvas.width,
            y: -50 - Math.random() * 400,
            seed: Math.random() * 1000,
            dx: 0,
            dy: 1.5 + Math.random() * 2,
            radius: 15 + Math.random() * 10,
            color: `hsl(${300 + Math.random() * 60}, 100%, 80%)`,
            trail: []
        });
    }
}

function drawMeteors() {
    for (let i = meteors.length - 1; i >= 0; i--) {
        let m = meteors[i];

        m.x += Math.sin(Date.now() / 300 + m.seed) * 1.5;
        m.y += m.dy;

        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 10) m.trail.shift();

        for (let c = 0; c < bricks.length; c++) {
            for (let r = 0; r < bricks[c].length; r++) {
                let b = bricks[c][r];
                if (b.status > 0 && b.type !== 'empty') {
                    let bx = b.x + brickWidth / 2;
                    let by = b.y + brickHeight / 2;
                    let dist = Math.sqrt((m.x - bx) ** 2 + (m.y - by) ** 2);
                    if (dist < m.radius + Math.max(brickWidth, brickHeight) / 2) {
                        if (b.type !== 'troll' && b.type !== 'bugcode') {
                            b.status = 0;
                            b.hp = 0;
                            score += (b.type === 'food' ? 50 : 10);
                            if (scoreDisplay) scoreDisplay.innerText = score;
                        } else if (b.type === 'bugcode' && boss && boss.phase !== 1) {
                            b.status = 0;
                            b.hp = 0;
                        }
                    }
                }
            }
        }

        if (boss && boss.active && boss.phase === 3) {
            let dist = Math.sqrt((m.x - boss.x) ** 2 + (m.y - boss.y) ** 2);
            if (dist < m.radius + boss.radius) {
                boss.hp -= 2;
                meteors.splice(i, 1);
                continue;
            }
        }

        for (let p = projectiles.length - 1; p >= 0; p--) {
            let proj = projectiles[p];
            if (proj.type === 'quote') {
                let dist = Math.sqrt((m.x - proj.x) ** 2 + (m.y - proj.y) ** 2);
                if (dist < m.radius + proj.width / 2) {
                    projectiles.splice(p, 1);
                }
            }
        }

        ctx.save();
        ctx.beginPath();
        if (m.trail.length > 0) {
            ctx.moveTo(m.trail[0].x, m.trail[0].y);
            for (let j = 1; j < m.trail.length; j++) {
                let pt = m.trail[j];
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = m.radius / 3;
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(Date.now() / 500 + m.seed);
        ctx.beginPath();
        let spikes = 5;
        let rot = Math.PI / 2 * 3;
        let x = 0, y = 0;
        let step = Math.PI / spikes;

        ctx.moveTo(0, -m.radius);
        for (let k = 0; k < spikes; k++) {
            x = Math.cos(rot) * m.radius;
            y = Math.sin(rot) * m.radius;
            ctx.lineTo(x, y);
            rot += step;
            x = Math.cos(rot) * (m.radius * 0.4);
            y = Math.sin(rot) * (m.radius * 0.4);
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(0, -m.radius);
        ctx.closePath();

        ctx.shadowColor = m.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = m.color;
        ctx.stroke();
        ctx.restore();

        if (m.y > canvas.height + 100) {
            meteors.splice(i, 1);
        }
    }
}

function drawUltimateGauge() {
    const barWidth = 20;
    const barHeight = 300;
    const x = canvas.width - barWidth - 20;
    const y = (canvas.height - barHeight) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#333";
    ctx.fillRect(x + 2, y + 2, barWidth - 4, barHeight - 4);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x + barWidth - 5, y + 2, 3, barHeight - 4);
    ctx.fillRect(x + 2, y + barHeight - 5, barWidth - 4, 3);

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x + 2, y + 2, 3, barHeight - 4);
    ctx.fillRect(x + 2, y + 2, barWidth - 4, 3);

    const fillHeight = (ultimateGauge / MAX_GAUGE) * (barHeight - 4);
    if (fillHeight > 0) {
        const fillY = y + barHeight - 2 - fillHeight;

        let grad = ctx.createLinearGradient(0, y + barHeight, 0, y);
        grad.addColorStop(0, "#ff69b4");
        grad.addColorStop(1, "#ffd700");

        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, fillY, barWidth - 4, fillHeight);

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(x + 2, fillY, 3, fillHeight);
        ctx.fillRect(x + 2, fillY, barWidth - 4, 3);
    }

    const heartX = x + barWidth / 2;
    const heartY = y - 50;
    let heartSize = 70;

    ctx.save();
    if (ultimateGauge >= MAX_GAUGE) {
        heartSize = 65 + Math.sin(Date.now() / 100) * 15;
        const hue = (Date.now() / 10) % 360;

        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#fff";

        ctx.font = `bold ${heartSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.lineWidth = 5;
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.strokeText("♥", heartX, heartY);
        ctx.fillText("♥", heartX, heartY);

        for (let i = 0; i < 5; i++) {
            let offset = (Date.now() / 200 + i * (Math.PI * 2 / 5));
            let px = heartX + Math.cos(offset) * 45;
            let py = heartY + Math.sin(offset) * 45;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(${hue}, 100%, 80%)`;
            ctx.fill();
        }
    } else {
        ctx.shadowColor = "#ff1493";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ff69b4";

        ctx.font = `bold ${heartSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.strokeText("♥", heartX, heartY);
        ctx.fillText("♥", heartX, heartY);
    }
    ctx.restore();
}

function drawBlackhole() {
    if (blackhole) {
        const elapsed = Date.now() - blackhole.createdAt;
        ctx.save();
        ctx.translate(blackhole.x, blackhole.y);
        ctx.rotate(elapsed / 200);
        ctx.fillStyle = "rgba(75, 0, 130, 0.4)";
        ctx.beginPath();
        ctx.arc(0, 0, blackhole.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "14px Consolas";
        ctx.textAlign = "center";
        ctx.fillText("while(true)", 0, 5);
        ctx.restore();
    }
}

function drawPaddle() {
    // 패들 디버프 원복 체크
    if (paddle.debuffTimer > 0) {
        if (Date.now() - paddle.debuffTimer > 5000) {
            paddle.debuffTimer = 0;
            paddle.width = 150;
        }
    }

    if (processedImg && processedImg.complete && processedImg.naturalWidth !== 0) {
        const imgW = 90;
        const imgH = 90;
        ctx.drawImage(processedImg, paddle.x + paddle.width / 2 - imgW / 2, paddle.y, imgW, imgH);
    }

    if (paddle.debuffTimer > 0) {
        drawPixelBlock(ctx, paddle.x, paddle.y, paddle.width, paddle.height, "#7b68ee");
    } else if (paddle.color && paddle.color.endsWith(".png")) {
        const img = loadedDesignImages[paddle.color];
        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, paddle.x, paddle.y, paddle.width, paddle.height);
        } else {
            drawPixelBlock(ctx, paddle.x, paddle.y, paddle.width, paddle.height, "#ff69b4");
        }
    } else {
        drawPixelBlock(ctx, paddle.x, paddle.y, paddle.width, paddle.height, paddle.color);
    }
}

function drawBricks() {
    const stage = stages[currentStageIndex];

    if (currentStageIndex === 4) {
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(255, 105, 180, 0.25)"; // 투명도를 0.85에서 0.25로 낮춰 가시성 확보
        ctx.shadowColor = "rgba(255, 20, 147, 0.5)"; // 글로우 효과도 은은하게
        ctx.shadowBlur = 5;
        ctx.font = "bold 16px Consolas, monospace";
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

        const startX = 220;
        const startY = 80;
        for (let i = 0; i < codeLines.length; i++) {
            ctx.fillText(codeLines[i], startX, startY + i * 20);
        }
        ctx.restore();
    }

    for (let c = 0; c < bricks.length; c++) {
        for (let r = 0; r < bricks[c].length; r++) {
            let b = bricks[c][r];
            if (b && b.status > 0) {
                let bw = brickWidth;
                let bh = brickHeight;
                let bx = (c * (bw + brickPadding)) + brickOffsetLeft + (b.offsetX || 0);
                let by = (r * (bh + brickPadding)) + brickOffsetTop + (b.offsetY || 0);

                if (currentStageIndex === 4) {
                    bx = (c * (110)) + 60;
                    by = (r * (50)) + 60;
                }

                b.x = bx;
                b.y = by;

                if (b.type === 'bugcode') {
                    ctx.save();
                    ctx.textAlign = "left";
                    ctx.textBaseline = "alphabetic";
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
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
                    ctx.restore();
                } else {
                    let text = b.text || "";
                    let isTroll = b.type === 'troll' || b.type === 'troll_hard';

                    if (currentStageIndex === 0) { // Stage 1: 지하철 (네모난 사람)
                        let renderW = 30;
                        let renderH = 45;
                        b.w = renderW;
                        b.h = renderH;
                        let bx1 = bx + (bw - renderW) / 2;
                        b.x = bx1;

                        let baseColor = b.hp >= 2 ? "#696969" : (isTroll ? "#a9a9a9" : "#87cefa");

                        ctx.fillStyle = baseColor;
                        // 머리
                        ctx.beginPath();
                        ctx.arc(bx1 + renderW / 2, by + 10, 10, 0, Math.PI * 2);
                        ctx.fill();
                        // 몸통
                        ctx.fillRect(bx1 + 2, by + 22, renderW - 4, 23);
                        // 어깨/팔
                        ctx.strokeStyle = baseColor;
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(bx1 - 5, by + 30);
                        ctx.lineTo(bx1 + 2, by + 22);
                        ctx.lineTo(bx1 + renderW - 2, by + 22);
                        ctx.lineTo(bx1 + renderW + 5, by + 30);
                        ctx.stroke();

                        if (isTroll) {
                            ctx.fillStyle = "red";
                            ctx.beginPath();
                            ctx.moveTo(bx1 + renderW / 2 - 8, by);
                            ctx.lineTo(bx1 + renderW / 2 - 4, by - 8);
                            ctx.lineTo(bx1 + renderW / 2, by);
                            ctx.moveTo(bx1 + renderW / 2, by);
                            ctx.lineTo(bx1 + renderW / 2 + 4, by - 8);
                            ctx.lineTo(bx1 + renderW / 2 + 8, by);
                            ctx.fill();
                        }
                    } else if (currentStageIndex === 1) { // Stage 2: 강의실 (네모난 말풍선)
                        let renderW = 120; // 말풍선 고정 길이 약간 늘림
                        b.w = renderW;

                        let bgColor = "#ffffff";
                        let strokeColor = "#888";
                        if (isTroll) {
                            strokeColor = "red";
                            if (b.hp === 3) bgColor = "#ff4c4c";
                            else if (b.hp === 2) bgColor = "#ff7f7f";
                            else bgColor = "#ffcccb";
                        }
                        ctx.fillStyle = bgColor;
                        ctx.strokeStyle = strokeColor;
                        ctx.lineWidth = 2;

                        // 네모 말풍선
                        ctx.beginPath();
                        ctx.rect(bx, by, renderW, bh);
                        ctx.fill();
                        ctx.stroke();
                        // 말풍선 꼬리 (아래쪽)
                        ctx.beginPath();
                        ctx.moveTo(bx + 15, by + bh);
                        ctx.lineTo(bx + 20, by + bh + 10);
                        ctx.lineTo(bx + 25, by + bh);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = isTroll ? "red" : "#000";
                        ctx.font = "bold 13px Consolas";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, bx + renderW / 2, by + bh / 2 + 1);

                    } else if (currentStageIndex === 2) { // Stage 3: 학식당 (음식)
                        b.w = 40;
                        b.h = 40;
                        let bx1 = bx + (bw - 40) / 2;
                        b.x = bx1;

                        if (b.type === 'food_sandwich') {
                            ctx.fillStyle = "#f5deb3"; // 빵
                            ctx.beginPath();
                            ctx.moveTo(bx1, by + 40);
                            ctx.lineTo(bx1 + 40, by + 40);
                            ctx.lineTo(bx1, by);
                            ctx.fill();
                            ctx.fillStyle = "#32cd32"; // 양상추
                            ctx.fillRect(bx1 + 4, by + 15, 20, 5);
                            ctx.fillStyle = "#ff6347"; // 토마토
                            ctx.fillRect(bx1 + 8, by + 25, 20, 5);
                        } else if (b.type === 'food_cake') {
                            ctx.fillStyle = "#ffb6c1"; // 크림
                            ctx.fillRect(bx1, by + 10, 40, 15);
                            ctx.fillStyle = "#deb887"; // 빵
                            ctx.fillRect(bx1, by + 25, 40, 15);
                            ctx.fillStyle = "#dc143c"; // 체리
                            ctx.beginPath();
                            ctx.arc(bx1 + 20, by + 5, 5, 0, Math.PI * 2);
                            ctx.fill();
                        } else if (b.type === 'food_drink') {
                            ctx.fillStyle = "#87cefa"; // 컵
                            ctx.beginPath();
                            ctx.moveTo(bx1 + 5, by + 40);
                            ctx.lineTo(bx1 + 35, by + 40);
                            ctx.lineTo(bx1 + 40, by + 10);
                            ctx.lineTo(bx1, by + 10);
                            ctx.fill();
                            ctx.strokeStyle = "#ff4500"; // 빨대
                            ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(bx1 + 20, by + 15);
                            ctx.lineTo(bx1 + 30, by);
                            ctx.stroke();
                        } else { // food_orange
                            ctx.fillStyle = "#ffa500";
                            ctx.beginPath();
                            ctx.arc(bx1 + 20, by + 20, 18, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = "#228b22"; // 잎
                            ctx.beginPath();
                            ctx.ellipse(bx1 + 20, by + 2, 8, 3, Math.PI / 4, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    } else if (currentStageIndex === 3) { // Stage 4: 팀플 (카톡 말풍선)
                        let bgColor = b.isRight ? "#fef01b" : "#ffffff";
                        let renderX = b.isRight ? bx + 40 : bx - 20;
                        let renderW = 200; // 넓은 말풍선
                        let renderH = 30; // 약간 더 높게

                        b.x = renderX;
                        b.w = renderW;
                        b.h = renderH;

                        // 카톡 말풍선 스타일
                        ctx.fillStyle = bgColor;
                        ctx.strokeStyle = "#ccc";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.roundRect(renderX, by, renderW, renderH, 10);
                        ctx.fill();
                        ctx.stroke();

                        // 카톡 꼬리
                        ctx.beginPath();
                        if (b.isRight) {
                            ctx.moveTo(renderX + renderW, by + 10);
                            ctx.lineTo(renderX + renderW + 10, by + 15);
                            ctx.lineTo(renderX + renderW, by + 20);
                        } else {
                            ctx.moveTo(renderX, by + 10);
                            ctx.lineTo(renderX - 10, by + 15);
                            ctx.lineTo(renderX, by + 20);
                        }
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = "#000";
                        ctx.font = "12px 'Malgun Gothic', Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, renderX + renderW / 2, by + renderH / 2 + 1);
                    } else {
                        // 기타 스테이지 기본 벽돌
                        let bgColor = b.hp >= 2 ? "#555555" : "#FF5733";
                        drawPixelBlock(ctx, bx, by, bw, bh, bgColor);
                    }
                }
            }
        }
    }
}

function drawBoss() {
    if (!boss) return;

    // phase 2 (WARNING) 또는 phase 3 (active) 모두 HP 바를 그리는 헬퍼
    const drawBossHpBar = () => {
        const bossHpBarX = canvas.width / 2;
        const bossHpBarY = 30;
        const barW = 200;
        const barH = 16;
        ctx.fillStyle = "#000";
        ctx.fillRect(bossHpBarX - barW / 2 - 2, bossHpBarY - 2, barW + 4, barH + 4);
        ctx.fillStyle = "#333";
        ctx.fillRect(bossHpBarX - barW / 2, bossHpBarY, barW, barH);
        ctx.fillStyle = "red";
        const safeHp = (typeof boss.hp === 'number' && !isNaN(boss.hp)) ? boss.hp : boss.maxHp;
        const safeMaxHp = (typeof boss.maxHp === 'number' && !isNaN(boss.maxHp) && boss.maxHp > 0) ? boss.maxHp : Math.max(safeHp, 1);
        let hpRatio = Math.max(0, Math.min(1, safeHp / safeMaxHp));
        ctx.fillRect(bossHpBarX - barW / 2, bossHpBarY, hpRatio * barW, barH);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Consolas";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`BOSS HP: ${Math.max(0, safeHp)} / ${safeMaxHp}`, bossHpBarX, bossHpBarY + barH - 2);
        ctx.textAlign = "left";
    };

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
            ctx.fillText("! WARNING !", canvas.width / 2, canvas.height / 2 - 40);
            ctx.font = "bold 24px Consolas";
            ctx.fillText("FATAL ERROR: MISSING SEMICOLON", canvas.width / 2, canvas.height / 2 + 5);
            ctx.fillStyle = "#ffcc00";
            ctx.font = "bold 22px 'Malgun Gothic', Arial";
            ctx.fillText("아! 뭘 빼먹었는지 깨달았어!", canvas.width / 2, canvas.height / 2 + 45);
            ctx.textAlign = "left";
        }
        ctx.restore();
        // WARNING 중에도 HP 바 표시
        drawBossHpBar();
    } else if (boss.active && boss.phase === 3) {
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 80px Consolas";
        ctx.fillText(";", boss.x - 20, boss.y + 30);
        drawBossHpBar();
    }
}

// 7. 충돌 감지
function collisionDetection() {
    const stage = stages[currentStageIndex];

    balls.forEach(ball => {
        for (let c = 0; c < bricks.length; c++) {
            for (let r = 0; r < bricks[c].length; r++) {
                let b = bricks[c][r];
                if (b && b.status > 0 && b.type !== 'empty') {
                    let bw = b.w || brickWidth;
                    let bh = b.h || brickHeight;

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
                        let overlap = ball.radius - distance;
                        if (distance > 0) {
                            ball.x += (distX / distance) * overlap;
                            ball.y += (distY / distance) * overlap;

                            let nx = distX / distance;
                            let ny = distY / distance;
                            let dot = ball.dx * nx + ball.dy * ny;
                            if (dot < 0) {
                                ball.dx -= 2 * dot * nx;
                                ball.dy -= 2 * dot * ny;
                            }
                        } else {
                            ball.y -= overlap;
                            ball.dy = -Math.abs(ball.dy);
                        }

                        if (b.type === 'troll') {
                            b.status = 0;
                            score += 500;
                            if (scoreDisplay) scoreDisplay.innerText = score;
                        } else if (b.type !== 'bugcode' || (b.type === 'bugcode' && boss.phase === 1)) {
                            b.hp--;
                            b.status = b.hp;
                            if (b.hp <= 0) {
                                score += (b.type === 'food' ? 50 : 10);
                                if (scoreDisplay) scoreDisplay.innerText = score;
                                ultimateGauge = Math.min(ultimateGauge + 5, MAX_GAUGE);
                            }
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
                    if (!boss.lastHitTime || now - boss.lastHitTime > 200) {
                        boss.hp--;
                        score += 10;
                        if (scoreDisplay) scoreDisplay.innerText = score;
                    }
                }
            }
        }
    });
    if (stage.isCleared()) {
        isGameRunning = false;
        cancelAnimationFrame(animationId);

        let baseEarned = score - stageBaseScore;
        let timeBonus = timeLeft > 0 ? timeLeft * 10 : 0;
        score += timeBonus;
        if (scoreDisplay) scoreDisplay.innerText = score;

        let stageEarned = baseEarned + timeBonus;
        let grade = getGrade(stageEarned);

        let bonusMessage = "";
        if (currentStageIndex === 2) {
            lives += 2;
            if (livesDisplay) livesDisplay.innerText = lives;
            bonusMessage = "\n[보너스] 라이프 2 획득!\n";
        }

        // 최고 기록 갱신 및 로컬 스토리지 저장
        if (currentStageIndex + 1 > maxUnlockedStage && currentStageIndex + 1 < stages.length) {
            maxUnlockedStage = currentStageIndex + 1;
            localStorage.setItem('maxUnlockedStage', maxUnlockedStage);
        }

        currentStageIndex++;
        if (currentStageIndex < stages.length) {
            showMainScreen(
                "스테이지 클리어!",
                `기본 스코어: ${baseEarned}\n시간 보너스: +${timeBonus}\n합산 스코어: ${stageEarned}\n이번 스테이지 등급: [ ${grade} ]\n${bonusMessage}\n${stages[currentStageIndex].time} 으로 이동합니다.`,
                "next"
            );
        } else {
            showMainScreen(
                "A+ 학점 달성!",
                `기본 스코어: ${baseEarned}\n시간 보너스: +${timeBonus}\n합산 스코어: ${stageEarned}\n최종 학점: [ ${grade} ]\n${bonusMessage}\n수고하셨습니다. 완벽한 하루였습니다.`,
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

    if (isDevMode) {
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
    } else {
        const startBtn = document.createElement("button");
        startBtn.className = "stage-btn";
        startBtn.innerText = "처음부터";
        startBtn.addEventListener("click", () => {
            startGame(0);
        });
        container.appendChild(startBtn);

        if (maxUnlockedStage > 0) {
            const continueBtn = document.createElement("button");
            continueBtn.className = "stage-btn";
            continueBtn.innerText = "이어하기";
            continueBtn.addEventListener("click", () => {
                startGame(currentStageIndex);
            });
            container.appendChild(continueBtn);
        }
    }
}

function showMainScreen(title, desc, mode = "next") {
    if (pauseOverlay) pauseOverlay.style.display = "none";
    mainScreen.style.display = "flex";
    if (mainTitle) mainTitle.innerText = title;
    if (mainDesc) mainDesc.innerText = desc;

    const stageSelect = document.getElementById("stage-select-container");
    if (mode === "menu") {
        if (mainStartBtn) {
            mainStartBtn.style.display = isDevMode ? "block" : "none";
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

    // 아이템 및 투사체 업데이트
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.y += item.dy;
        if (item.y + item.radius >= paddle.y && item.y - item.radius <= paddle.y + paddle.height &&
            item.x + item.radius >= paddle.x && item.x - item.radius <= paddle.x + paddle.width) {
            if (balls.length > 0) {
                let refBall = balls[0];
                balls.push(createBall(refBall.x, refBall.y, -refBall.dx, -Math.abs(refBall.dy), false));
            } else {
                balls.push(createBall(canvas.width / 2, paddle.y - 150, BASE_SPEED / Math.SQRT2, -BASE_SPEED / Math.SQRT2, true));
            }
            items.splice(i, 1);
            score += 50;
            if (scoreDisplay) scoreDisplay.innerText = score;
        } else if (item.y > canvas.height) {
            items.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.dx;
        p.y += p.dy;

        let hit = false;

        if (p.type === 'debuff') {
            if (p.y + p.radius >= paddle.y && p.y - p.radius <= paddle.y + paddle.height &&
                p.x + p.radius >= paddle.x && p.x - p.radius <= paddle.x + paddle.width) {
                paddle.debuffTimer = now;
                paddle.width = 75;
                hit = true;
            }
        } else if (p.type === 'quote') {
            let pLeft = p.x - p.width / 2;
            let pRight = p.x + p.width / 2;
            let pTop = p.y - p.height / 2;
            let pBottom = p.y + p.height / 2;

            for (let j = balls.length - 1; j >= 0; j--) {
                let ball = balls[j];
                let testX = ball.x;
                let testY = ball.y;

                if (ball.x < pLeft) testX = pLeft;
                else if (ball.x > pRight) testX = pRight;

                if (ball.y < pTop) testY = pTop;
                else if (ball.y > pBottom) testY = pBottom;

                let distX = ball.x - testX;
                let distY = ball.y - testY;
                let distance = Math.sqrt((distX * distX) + (distY * distY));

                if (distance <= ball.radius && !ball.isRespawning) {
                    let overlap = ball.radius - distance;
                    if (distance > 0) {
                        ball.x += (distX / distance) * overlap;
                        ball.y += (distY / distance) * overlap;
                        let nx = distX / distance;
                        let ny = distY / distance;
                        let dot = ball.dx * nx + ball.dy * ny;
                        if (dot < 0) {
                            ball.dx -= 2 * dot * nx;
                            ball.dy -= 2 * dot * ny;
                        }
                    } else {
                        ball.y -= overlap;
                        ball.dy = -Math.abs(ball.dy);
                    }

                    if (p.text === '""') {
                        p.text = "''";
                        score += 10;
                    } else {
                        hit = true;
                        score += 20;
                    }
                    if (scoreDisplay) scoreDisplay.innerText = score;
                    ultimateGauge = Math.min(ultimateGauge + 5, MAX_GAUGE);
                }
            }
        }

        if (hit || p.y > canvas.height) {
            projectiles.splice(i, 1);
        }
    }

    // 공 업데이트
    for (let i = balls.length - 1; i >= 0; i--) {
        let ball = balls[i];

        if (!ball.isRespawning) {
            if (blackhole) {
                let dx = blackhole.x - ball.x;
                let dy = blackhole.y - ball.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 10 && dist < 150) {
                    ball.dx += (dx / dist) * 0.15;
                    ball.dy += (dy / dist) * 0.15;

                    let speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    ball.dx = (ball.dx / speed) * BASE_SPEED;
                    ball.dy = (ball.dy / speed) * BASE_SPEED;
                }
            }

            ball.x += ball.dx;
            ball.y += ball.dy;
        }

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
                ball.y = canvas.height - ball.radius;
                ball.dy = -Math.abs(ball.dy);
            } else {
                ball.markForDeletion = true;
            }
        }

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
            if (testY === paddle.y) {
                let hitPoint = ball.x - (paddle.x + paddle.width / 2);
                let normalizedHitPoint = hitPoint / (paddle.width / 2);
                let bounceAngle = normalizedHitPoint * (Math.PI / 3);
                ball.dx = BASE_SPEED * Math.sin(bounceAngle);
                ball.dy = -Math.abs(BASE_SPEED * Math.cos(bounceAngle));
            } else {
                if (testX === paddle.x || testX === paddle.x + paddle.width) {
                    ball.dx = -ball.dx;
                } else {
                    ball.dy = Math.abs(ball.dy);
                }
            }
            ultimateGauge = Math.min(ultimateGauge + 2.5, MAX_GAUGE);
        }
    }

    for (let i = balls.length - 1; i >= 0; i--) {
        if (balls[i].markForDeletion) {
            balls.splice(i, 1);
        }
    }

    if (balls.length === 0) {
        lives--;
        if (livesDisplay) livesDisplay.innerText = lives;
        if (lives > 0) {
            paddle.x = (canvas.width - paddle.width) / 2;
            balls.push(createBall(canvas.width / 2, paddle.y - 150, 0, 0, true));
        } else {
            isGameRunning = false;
            cancelAnimationFrame(animationId);
            showMainScreen("게임 오버", "다시 도전해보세요!", "return");
            currentStageIndex = 0;
            return;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (meteors.length > 0) {
        ultimateBgAlpha = Math.min(ultimateBgAlpha + 0.02, 0.4);
    } else {
        ultimateBgAlpha = Math.max(ultimateBgAlpha - 0.02, 0);
    }

    if (ultimateBgAlpha > 0 && magicalBeamImg.complete && magicalBeamImg.naturalWidth !== 0) {
        ctx.save();
        ctx.globalAlpha = ultimateBgAlpha;
        ctx.drawImage(magicalBeamImg, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    drawBlackhole();
    drawBricks();
    drawBoss();
    drawItems();
    drawProjectiles();
    drawPaddle();
    drawBalls();
    drawMeteors();
    drawUltimateGauge();

    // 파티클 렌더링
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.life / 5, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    collisionDetection();

    animationId = requestAnimationFrame(draw);
}

// 초기 화면 설정 (최초 로드 시 스테이지 선택 버튼 생성 및 게임 시작 버튼 표시)
showMainScreen("컴공생 마법소녀의 하루", "마법소녀의 힘으로 완벽한 하루를 보내자!", "menu");
