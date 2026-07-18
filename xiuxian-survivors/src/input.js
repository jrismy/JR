// 输入：桌面 WASD/方向键；移动端动态虚拟摇杆（按下处生成）
const keys = new Set();
let joyActive = false, joyId = -1;
let joyBaseX = 0, joyBaseY = 0, joyDX = 0, joyDY = 0;
let joyEl = null, knobEl = null;
export const callbacks = { pause: null, debug: null };

export function initInput() {
  joyEl = document.getElementById('joy');
  knobEl = document.getElementById('joyKnob');

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if ((e.code === 'KeyP' || e.code === 'Escape') && callbacks.pause) callbacks.pause();
    if (e.code === 'F3') { e.preventDefault(); callbacks.debug && callbacks.debug(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const stage = document.getElementById('stage');
  stage.addEventListener('touchstart', (e) => {
    if (joyActive) return;
    const t = e.changedTouches[0];
    joyActive = true; joyId = t.identifier;
    joyBaseX = t.clientX; joyBaseY = t.clientY;
    joyDX = 0; joyDY = 0;
    joyEl.style.display = 'block';
    joyEl.style.left = (joyBaseX - 60) + 'px';
    joyEl.style.top = (joyBaseY - 60) + 'px';
    e.preventDefault();
  }, { passive: false });
  stage.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const dx = t.clientX - joyBaseX, dy = t.clientY - joyBaseY;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, 52);
      joyDX = (dx / len) * (cl / 52);
      joyDY = (dy / len) * (cl / 52);
      knobEl.style.transform = `translate(calc(-50% + ${(dx / len) * cl}px), calc(-50% + ${(dy / len) * cl}px))`;
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyActive = false; joyId = -1; joyDX = 0; joyDY = 0;
      joyEl.style.display = 'none';
      knobEl.style.transform = 'translate(-50%, -50%)';
    }
  };
  stage.addEventListener('touchend', endTouch);
  stage.addEventListener('touchcancel', endTouch);
}

// 归一化移动向量
export function getMove() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (joyActive) { x += joyDX; y += joyDY; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}
