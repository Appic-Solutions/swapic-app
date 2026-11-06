'use client';
// The coin field (Jeff 2026-11-05, after Uniswap's home page): every coin Swapic carries, small, flat and blurred, scattered
// behind the page. Each coin has two walls of its own, one above and one below it, and moves very slowly from one to the other
// and back. Under the mouse a coin stops, sharpens, grows a little and turns toward the cursor in real 3D, from nine rendered
// angles. Panels and controls stay on top.
//
// Built to cost next to nothing. The travel is one Web Animation per coin on transform with plain numbers, so it runs on the
// GPU and the main thread does nothing at rest. The blur is baked into tiny images (coin-rest.ts), so nothing blurs live, and
// the panels above never repaint: every change here is transform or opacity. A coin's sharp frames load the first time the
// mouse comes near it. React renders once; hover changes classes and image sources directly. Desktop only (Backdrop.tsx),
// and the styles are in globals.css (.coin).
import * as React from 'react';
import { COIN_REST } from './coin-rest';

/**
 * name, center across and down the window in %, coin size in px, px between its two walls, seconds from wall to wall,
 * where it starts (0 at its top wall going down, 1 at its bottom wall going up).
 */
type Coin = [name: string, x: number, y: number, size: number, walls: number, seconds: number, start: number];
const COINS: Coin[] = [
  ['ethereum', 9, 24, 100, 48, 18, 0.2], ['btc', 88, 20, 105, 55, 20.25, 1.3], ['usdc', 16, 74, 96, 44, 15, 0.7], ['sol', 82, 76, 91, 50, 18.75, 1.7],
  ['icp', 3, 50, 82, 42, 14.25, 1.1], ['optimism', 96, 48, 75, 36, 12.75, 0.4], ['arbitrum', 22, 13, 68, 32, 11.25, 1.6], ['base', 72, 16, 73, 34, 12, 0.9],
  ['polygon', 27, 88, 66, 38, 13.5, 1.4], ['unichain', 70, 91, 71, 32, 11.25, 0.1], ['monad', 40, 17, 59, 28, 10.5, 1.8], ['hyperevm', 58, 93, 62, 30, 11.25, 0.6],
  ['worldchain', 5, 88, 68, 40, 14.25, 1.2], ['plasma', 94, 88, 64, 36, 12.75, 0.3], ['gldt', 20, 46, 80, 46, 16.5, 1.9], ['ogy', 79, 46, 78, 44, 15.75, 0.5],
];
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

export default function CoinField() {
  const layer = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const box = layer.current!;
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
        const [, , y, size, walls, seconds, start] = COINS[i]!;
        const gap = walls * room;
        const top = Math.max(Math.min((height * y) / 100 - (size + gap) / 2, height - size - gap - EDGE), EDGE);
        const trip = el.animate(
          [{ transform: `translate3d(0,${top}px,0)` }, { transform: `translate3d(0,${top + gap}px,0)` }],
          { duration: seconds * 1000 * room, iterations: Infinity, direction: 'alternate', easing: 'linear', fill: 'both' },
        );
        trip.currentTime = seconds * 1000 * room * (at[i] ?? start);
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
  }, []);
  return (
    <div ref={layer} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-screen overflow-hidden">
      {COINS.map(([name, x, , size]) => (
        <div
          key={name}
          data-coin={name}
          className="coin"
          style={{ left: `${x}%`, width: size, height: size, marginLeft: -size / 2 }}
        >
          <div className="coin-face">
            <img className="coin-rest" src={COIN_REST[name]} alt="" />
            <div className="coin-sharp">
              <img alt="" />
              <img alt="" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
