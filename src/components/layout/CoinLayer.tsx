// The coin field as the page draws it: every coin, resting and blurred, from one small image, with no code at all. So the coins
// are there with the first paint even on a slow connection, and only a wide screen with a mouse downloads the image (.coin-layer
// in globals.css). Each sits midway between its walls; coin-motion.ts starts them from there when it arrives.
import { COINS, REST_ACROSS } from './coin-table';

const cell = (n: number) => `${(n * 100) / (REST_ACROSS - 1)}%`;

export function CoinLayer() {
  return (
    <div aria-hidden data-coins className="coin-layer pointer-events-none absolute inset-x-0 top-0 z-[-1] h-screen overflow-hidden">
      {COINS.map(([name, x, y, size], i) => (
        <div
          key={name}
          data-coin={name}
          className="coin"
          style={{ left: `${x}%`, width: size, height: size, marginLeft: -size / 2, transform: `translate3d(0,calc(${y}vh + ${-size / 2}px),0)` }}
        >
          <div className="coin-face">
            <div className="coin-rest" style={{ backgroundPosition: `${cell(i % REST_ACROSS)} ${cell(Math.floor(i / REST_ACROSS))}` }} />
            <div className="coin-sharp">
              <div />
              <div />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
