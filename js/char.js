// One typed/dispersing letter - its position, font, color, and its
// grow/disperse/fade animation state.

class Char {
    constructor(character, font, col, startPos) {
        this.character = character;
        this.font = font;
        this.col = col;
        this.pos = startPos.copy();
        this.targetPos = startPos.copy();
        this.vel = new p5.Vector(0, 0);
        this.rot = 0;
        this.rotVel = 0;
        this.age = 0;
        this.fadeTimer = startFade;
        this.dispersing = false;
        this.baseSize = bigSize;
    }

    setTarget(x, y) {
        this.targetPos.set(x, y);
    }

    disperse() {
        this.dispersing = true;
        const angle = random(TWO_PI);
        const speed = random(3, 8);
        this.vel = p5.Vector.fromAngle(angle).mult(speed);
        this.rotVel = random(-0.2, 0.2);
        this.fadeTimer = startFade;
    }

    update() {
        if (this.dispersing) {
            this.pos.add(this.vel);
            this.vel.mult(0.995);
            this.rot += this.rotVel;
            this.fadeTimer--;
        } else {
            this.pos.lerp(this.targetPos, lerpSpeed);
            this.age++;
        }
    }

    show() {
        this.update();
        const scale = this.dispersing ? 1.0 : constrain(this.age / growFrames, 0, 1);
        const alpha = this.dispersing ? constrain(this.fadeTimer / startFade, 0, 1) : 1.0;
        if (alpha <= 0) return;

        push();
        const displayColor = lerpColor(colors[this.col], contrastColor, letterBlend);
        // Explicit-component fill, not fill(p5.Color, alpha) - keeps
        // everything reading through the same 0..1 colorMode(RGB, 1.0)
        // channels the rest of the sketch uses.
        fill(red(displayColor), green(displayColor), blue(displayColor), alpha);
        useFont(this.font);
        translate(this.pos.x, this.pos.y);
        rotate(this.rot);
        textSize(this.baseSize * scale);
        text(this.character, 0, 0);
        pop();
    }

    isDead() {
        return this.dispersing && this.fadeTimer <= 0;
    }
}
