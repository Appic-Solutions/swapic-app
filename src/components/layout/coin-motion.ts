// What moves the coin field (Jeff 2026-11-05): the page already holds the coins (CoinLayer), resting and blurred; this small
// file arrives later and brings them to life. Each coin has two walls of its own, one above and one below it, and moves very
// slowly from one to the other and back. Under the mouse a coin stops, sharpens, grows a little and turns toward the cursor in
// real 3D, from nine rendered angles. Panels and controls stay on top.
//
// Built to cost next to nothing. The travel is one Web Animation per coin on transform with plain numbers, so it runs on the
// GPU and the main thread does nothing at rest. A coin's sharp frames load the first time the mouse comes near it. Hover changes
// classes and image sources directly, nothing renders. The styles are in globals.css (.coin).
import { COINS } from './coin-table';

/** A coin's walls stay this far inside the window. */
const EDGE = 12;
/** Window height in px below which the walls start to close in. */
const TALL = 800;
const LAST = 8;
const MID = LAST / 2;
const FOLLOW = 0.14;
/** A hovered coin has grown 15%, so the mouse has to leave a wider circle than it came in by, or the rim blinks on and off. */
const STAY = 1.2;
const frame = (name: string, i: number) => `/images/coins/${name}-${i}.webp`;
/** Whether a panel, a card or a control sits at this point. The page itself has no background of its own, anything over it has. */
function covered(x: number, y: number) {
  const top = document.elementFromPoint(x, y);
  const main = top?.closest('main');
  for (let el = top; main && el && el !== main; el = el.parentElement) {
    if (el.matches('a, button, input')) return true;
    const look = getComputedStyle(el);
    if (look.backgroundColor !== 'rgba(0, 0, 0, 0)' || look.backgroundImage !== 'none') return true;
  }
  return false;
}

// each coin's frames, fetched and decoded once, the first time the mouse comes near
const loading = new Map<string, Promise<void>>();
function loadFrames(name: string) {
  let p = loading.get(name);
  if (!p) {
    p = Promise.all(Array.from({ length: LAST + 1 }, (_, i) => { const img = new Image(); img.src = frame(name, i); return img.decode().catch(() => {}); })).then(() => {});
    loading.set(name, p);
  }
  return p;
}


/** Starts the coins in this layer; the answer stops them. */
export function startCoins(box: HTMLElement): () => void {
  const coins = [...box.querySelectorAll<HTMLElement>('.coin')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the slow trip between a coin's two walls: straight there, straight back. Plain numbers, so the GPU runs it alone
  let trips: Animation[] = [];
  const travel = () => {
    const at = trips.map((t) => (t.effect?.getComputedTiming().progress ?? null));
    trips.forEach((t) => t.cancel());
    // a short window squeezes the coins together, so their walls close in with it and neighbours keep clear of each other
    const height = box.clientHeight, room = Math.min(height / TALL, 1);
    trips = coins.map((el, i) => {
      const [, , y, size, walls, seconds] = COINS[i]!;
      const gap = walls * room;
      const top = Math.max(Math.min((height * y) / 100 - (size + gap) / 2, height - size - gap - EDGE), EDGE);
      const trip = el.animate(
        [{ transform: `translate3d(0,${top}px,0)` }, { transform: `translate3d(0,${top + gap}px,0)` }],
        { duration: seconds * 1000 * room, iterations: Infinity, direction: 'alternate', easing: 'linear', fill: 'both' },
      );
      // every coin starts midway between its walls, where the page drew it, half of them going up
      trip.currentTime = seconds * 1000 * room * (at[i] ?? (i % 2 ? 1.5 : 0.5));
      if (still) trip.pause();
      return trip;
    });
  };
  travel();
  window.addEventListener('resize', travel, { passive: true });

  // hover: `hot` is the coin under the mouse, `lit` the one whose frames are showing (it stays lit while it turns back flat)
  let hot: HTMLElement | null = null;
  let lit: HTMLElement | null = null;
  let tilt = MID, now = MID, turning = 0, checking = 0, x = 0, y = 0;
  const trip = (el: HTMLElement) => trips[coins.indexOf(el)];
  const layers = (el: HTMLElement) => el.querySelectorAll<HTMLImageElement>('.coin-sharp img') as unknown as [HTMLImageElement, HTMLImageElement];

  const turn = () => {
    if (!lit) { turning = 0; return; }
    const target = hot === lit ? tilt : MID;
    now += (target - now) * FOLLOW;
    const done = hot !== lit && Math.abs(now - MID) < 0.02;
    if (done) now = MID;
    const low = Math.min(Math.floor(now), LAST - 1);
    const [a, b] = layers(lit);
    if (a.dataset.i !== String(low)) { a.src = frame(lit.dataset.coin!, low); b.src = frame(lit.dataset.coin!, low + 1); a.dataset.i = String(low); }
    b.style.opacity = String(now - low);
    // back flat and no longer hovered: nothing more to draw
    if (done) { lit = null; turning = 0; return; }
    turning = requestAnimationFrame(turn);
  };
  const wake = (el: HTMLElement) => {
    // back on the coin that is still turning flat: it carries on from where it is
    if (lit !== el) {
      if (lit) layers(lit)[1].style.opacity = '0';
      const [a, b] = layers(el);
      a.src = frame(el.dataset.coin!, MID); b.style.opacity = '0'; delete a.dataset.i;
      lit = el; now = MID;
    }
    hot = el;
    el.classList.add('on');
    trip(el)?.pause();
    if (!turning) turning = requestAnimationFrame(turn);
  };
  const sleep = () => {
    if (!hot) return;
    hot.classList.remove('on');
    if (!still) trip(hot)?.play();
    hot = null;
  };

  // once a frame at most, and only while the mouse moves. Coins are measured first; asking the page what is on top comes last,
  // and a coin behind a panel neither wakes nor loads its frames
  const check = () => {
    checking = 0;
    let found: HTMLElement | null = null;
    let near: HTMLElement[] = [];
    for (const el of coins) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, far = Math.hypot(x - cx, y - cy);
      if (far < r.width + 60) near.push(el);
      if (far < (r.width / 2) * (el === hot ? STAY : 1)) { found = el; tilt = Math.min(Math.max((x - r.left) / r.width, 0), 1) * LAST; }
    }
    if (near.length && covered(x, y)) { near = []; found = null; }
    near.forEach((el) => void loadFrames(el.dataset.coin!));
    if (found === hot) return;
    sleep();
    if (found) { const el = found; void loadFrames(el.dataset.coin!).then(() => { if (!hot) wake(el); }); }
  };
  const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; if (!checking) checking = requestAnimationFrame(check); };
  window.addEventListener('pointermove', move, { passive: true });
  // scrolled past the first screen: nothing to run. A plain scroll check on purpose: an IntersectionObserver anywhere on the
  // page makes Chrome wake the main thread every frame while these animations run (measured: 3 ms of work against 94 ms)
  let away = false;
  const scrolled = () => {
    const past = box.getBoundingClientRect().bottom < 0;
    if (past === away) return;
    away = past;
    trips.forEach((t, i) => { if (coins[i] === hot || still) return; if (past) t.pause(); else t.play(); });
  };
  window.addEventListener('scroll', scrolled, { passive: true, capture: true });
  return () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('resize', travel);
    window.removeEventListener('scroll', scrolled, { capture: true });
    cancelAnimationFrame(turning); cancelAnimationFrame(checking); trips.forEach((t) => t.cancel());
  };
}
