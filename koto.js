// =======================================
//  KOTO 诗歌粒子场 + 鼠标静止时组成 “KOTO” 字母 (p5.js 版)
// =======================================

let particles = [];
let metaCircles = [];
let entropySystem;

let sysFont;   // 用于日文
let engFont;   // 用于英文

const MAX_PARTICLES = 800;

// 诗歌内容：日文
const POEM_LINES = [
  "人類は小さい",
  "二十億光年の孤独に比べれば",
  "星はたくさんある",
  "ただ黙って光っている",
  "宇宙はひずんでいる",
  "だからこそ　みんなはもとめ合う",
  "夜は深く",
  "星は果てしない"
];

// 鼠标静止检测 & KOTO 形状控制
let lastMoveTime = 0;          
let formKOTO = false;          
const IDLE_THRESHOLD = 2000;   // 鼠标停超过 2 秒触发 KOTO

// KOTO 字样设置
let KOTO_WORD = "KOTO";        // 想改单词改这里即可

// -------------------------------------
function setup() {
  createCanvas(1600, 1200);    // 想做自适应可以换成 windowWidth, windowHeight

  sysFont = 'serif';
  engFont = 'sans-serif';

  textAlign(CENTER, CENTER);
  smooth();

  entropySystem = new EntropySystem();

  // 初始化元球
  for (let i = 0; i < 160; i++) {
    let line = POEM_LINES[i % POEM_LINES.length];
    let c = line.charAt(0);  
    let mc = new MetaCircle(
      random(width * 0.1, width * 0.9),
      random(height * 0.1, height * 0.9),
      random(30, 80),
      color(random(255), 150, 255, 180),
      c
    );
    metaCircles.push(mc);
  }

  // 分配 K / O / T / O 的目标位置
  assignKotoTargetsByGroup();

  // 初始化粒子
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push(new QuantumChar());
  }

  lastMoveTime = millis();
}

function draw() {
  if (millis() - lastMoveTime > IDLE_THRESHOLD) {
    formKOTO = true;   
  } else {
    formKOTO = false;  
  }

  blendMode(BLEND);
  background(0);

  entropySystem.update(particles);
  drawProbabilityCloud();
  updateMetaCircles();
  updateParticles();
  drawInformationFlows();
  drawKotoOverlay();
}

// -------------------------------------
// 鼠标交互
// -------------------------------------
function mouseMoved() {
  lastMoveTime = millis();

  for (let mc of metaCircles) {
    if (p5.Vector.dist(mc.pos, createVector(mouseX, mouseY)) < 150) {
      mc.target.set(
        mouseX + random(-50, 50),
        mouseY + random(-50, 50)
      );
    }
  }
}

function mouseDragged() {
  lastMoveTime = millis();
}

function mousePressed() {
  // 本地测试截屏可以开
  // saveCanvas('koto', 'png');
}

// -------------------------------------
// 熵值计算系统
// -------------------------------------
class EntropySystem {
  constructor() {
    this.frequencyMap = {};
    this.probabilityMap = {};
    this.currentEntropy = 0;
  }

  update(particles) {
    this.frequencyMap = {};
    for (let p of particles) {
      let c = p.symbol;
      if (!c) continue;
      if (!this.frequencyMap[c]) this.frequencyMap[c] = 0;
      this.frequencyMap[c]++;
    }

    this.probabilityMap = {};
    let total = particles.length;
    if (total === 0) return;

    for (let c in this.frequencyMap) {
      this.probabilityMap[c] = this.frequencyMap[c] / total;
    }

    this.currentEntropy = this.calculateEntropy();
  }

  calculateEntropy() {
    let entropy = 0;
    for (let c in this.probabilityMap) {
      let p = this.probabilityMap[c];
      if (p > 0) {
        entropy += -p * (Math.log(p) / Math.log(2));
      }
    }
    return entropy;
  }
}

// -------------------------------------
// 粒子系统
// -------------------------------------
class Particle {
  constructor(pos, vel) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.life = 255;
    this.symbol = String.fromCharCode(int(random(33, 127)));
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 1.5;
    this.vel.mult(0.98);
  }

  display() {
    fill(255, this.life);
    textFont(engFont);
    textSize(12 + (255 - this.life) * 0.05);
    text(this.symbol, this.pos.x, this.pos.y);
  }

  isDead() {
    return this.life <= 0;
  }
}

class QuantumChar extends Particle {
  constructor() {
    super(createVector(random(width), random(height)), p5.Vector.random2D().mult(0.5));
    let line = random(POEM_LINES);
    let idx = floor(random(line.length));
    this.symbol = line.charAt(idx);
  }

  update() {
    super.update();
    for (let mc of metaCircles) {
      let d = p5.Vector.dist(this.pos, mc.pos);
      if (d < mc.radius) {
        let dir = p5.Vector.sub(mc.pos, this.pos);
        dir.mult(0.01);
        this.vel.add(dir);
      }
    }
  }

  display() {
    fill(255, this.life);
    textFont(sysFont);
    textSize(18);
    text(this.symbol, this.pos.x, this.pos.y);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.display();
    if (p.isDead()) {
      particles.splice(i, 1);
      particles.push(new QuantumChar());
    }
  }
}

// -------------------------------------
// 元球系统
// -------------------------------------
class MetaCircle {
  constructor(x, y, r, col, ch) {
    this.pos = createVector(x, y);
    this.target = this.pos.copy();
    this.vel = createVector(0, 0);
    this.radius = r;
    this.col = col;
    this.poemChar = ch;

    this.kotoTarget = null;
    this.inKotoMode = false;
    this.kotoLetterIndex = -1; 
  }

  update() {
    if (!this.inKotoMode) {
      if (frameCount % 120 === 0) {
        this.target.set(
          random(width * 0.1, width * 0.9),
          random(height * 0.1, height * 0.9)
        );
      }
      this.pos.lerp(this.target, 0.05);
    } else {
      if (this.kotoTarget) {
        this.pos.lerp(this.kotoTarget, 0.12);
      }
    }

    this.radius = 60 + sin(frameCount * 0.03) * 20;
  }

  display() {
    noFill();
    stroke(red(this.col), green(this.col), blue(this.col), 50);
    ellipse(this.pos.x, this.pos.y, this.radius * 2, this.radius * 2);

    fill(255, 220);

    if (this.inKotoMode && this.kotoLetterIndex >= 0) {
      textFont(engFont);
      textSize(this.radius * 0.7);
      let letter = KOTO_WORD.charAt(this.kotoLetterIndex);
      text(letter, this.pos.x, this.pos.y);
    } else {
      textFont(sysFont);
      textSize(this.radius * 0.6);
      text(this.poemChar, this.pos.x, this.pos.y);
    }
  }
}

function updateMetaCircles() {
  for (let mc of metaCircles) {
    mc.inKotoMode = formKOTO;
    mc.update();
    mc.display();
  }
}

// -------------------------------------
// 为每个元球分配 KOTO 目标（4 个团）
// -------------------------------------
function assignKotoTargetsByGroup() {
  let n = metaCircles.length;
  let letters = KOTO_WORD.length; 

  let totalWidth = width * 0.6;
  let startX = width * 0.2;
  let centerY = height * 0.45;
  let stepX = totalWidth / (letters - 1);

  for (let i = 0; i < n; i++) {
    let mc = metaCircles[i];

    let letterIndex = floor(map(i, 0, n, 0, letters));
    if (letterIndex >= letters) letterIndex = letters - 1;

    let cx = startX + stepX * letterIndex;
    let cy = centerY;

    let jitterR = 80;
    let angle = random(TWO_PI);
    let distR = random(jitterR);
    let jx = cx + cos(angle) * distR;
    let jy = cy + sin(angle) * distR;

    mc.kotoTarget = createVector(jx, jy);
    mc.kotoLetterIndex = letterIndex;
  }
}

// -------------------------------------
// 可视化辅助函数
// -------------------------------------
function drawProbabilityCloud() {
  if (!entropySystem.probabilityMap) return;

  push();
  noStroke();
  textFont(sysFont);
  for (let c in entropySystem.probabilityMap) {
    let prob = entropySystem.probabilityMap[c];
    let alpha = map(prob, 0, 0.1, 80, 220);
    let size = map(prob, 0, 0.1, 10, 40);
    fill(255, alpha);
    textSize(size);
    text(c, random(width), random(height));
  }
  pop();
}

function drawInformationFlows() {
  stroke(255, 25);
  strokeWeight(1);
  for (let p of particles) {
    for (let mc of metaCircles) {
      if (p5.Vector.dist(p.pos, mc.pos) < mc.radius * 2.0) {
        line(p.pos.x, p.pos.y, mc.pos.x, mc.pos.y);
      }
    }
  }
}

function drawKotoOverlay() {
  push();
  textAlign(CENTER, CENTER);
  textFont(engFont);
  fill(255, 40);
  textSize(width * 0.12);
  text(KOTO_WORD, width / 2, height * 0.18);
  pop();
}
