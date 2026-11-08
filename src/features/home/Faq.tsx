'use client';
// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c). The live FAQ: topics on the left, the open topic's questions on the right; the text exactly as designed.
import * as React from 'react';
import { ArrowRightIcon, ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { section, titleText } from './Title';

const FAQ: { title: string; items: [string, string][] }[] = [
  {
    title: 'Swapping',
    items: [
      ['What is Swapic?', 'Swapic swaps tokens between chains in one step: Ethereum, Base, Arbitrum, Polygon and ICP.'],
      ['What does Gasless mean?', 'You only sign. Swapic sends the transaction and pays the network gas; it is part of the fee shown before you sign.'],
      ['How long does a swap take?', 'Most swaps arrive in seconds. Every option shows its time before you pick it.'],
      ["What if a swap can't finish?", 'Your money comes back as USDC (ckUSDC on ICP), and the swap page shows how much went to which wallet. A swap pays out in full or not at all, never half.'],
      ['Can I send to another wallet?', 'Yes. Open Send To Wallet and paste an EVM address or an ICP principal.'],
    ],
  },
  {
    title: 'Pool',
    items: [
      ['How does staking earn?', 'Swaps that use the pool pay a small fee, and all of it goes to stakers. Your stake grows as those fees come in.'],
      ['Can I withdraw anytime?', 'Yes, in USDC, with no exit fee. A stake made from an EVM wallet pays out on EVM chains, and one made from ICP pays out on ICP.'],
      ['Why can a withdrawal wait?', 'When the pool is busy on the chain you picked, your withdrawal waits in line, usually under an hour, then arrives by itself.'],
      ['Can my stake go down?', 'It is built to grow from swap fees, but no return is guaranteed.'],
    ],
  },
  {
    title: 'Safety',
    items: [
      ['Can I follow my swap?', 'Yes. Every swap has a page in the Scanner with each step, its time and its transaction.'],
      ['Who can see my swaps?', 'Swaps are public on the chains they use, so anyone can look them up in the Scanner by wallet or transaction.'],
      ['Do I need an account?', 'No. Connect an EVM wallet, an ICP wallet (OISY, NFID or Internet Identity), or both.'],
    ],
  },
];

export function Faq() {
  const [topic, setTopic] = React.useState(0);
  const [open, setOpen] = React.useState(0);
  return (
    <section className={cn(section, 'gap-x-14 lg:flex-row lg:items-start')}>
      <div className="flex flex-col gap-y-8 lg:min-w-[400px] lg:gap-y-12">
        <div className="flex flex-col gap-y-3">
          <p className={titleText}>FAQ</p>
          <p className="max-w-[375px] text-sm leading-6 text-secondary md:text-base">Quick answers about swapping, the pool and safety.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row lg:flex-col">
          {FAQ.map((t, i) => (
            <div
              key={t.title}
              onClick={() => { setTopic(i); setOpen(0); }}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-between gap-x-4 rounded-3xl border p-5 font-medium text-white transition-colors duration-150 active:scale-[0.98]',
                topic === i ? 'border-blue-600 bg-highlighted-card' : 'border-line bg-input-fields hover:border-line-strong',
              )}
            >
              {t.title}
              <ArrowRightIcon width={20} height={20} />
            </div>
          ))}
        </div>
      </div>
      <div key={topic} className="flex flex-1 animate-fade flex-col gap-y-4">
        {FAQ[topic]!.items.map(([q, a], i) => (
          <div
            key={q}
            onClick={() => setOpen(i)}
            className={cn(
              'flex cursor-pointer flex-col gap-y-3 overflow-hidden rounded-3xl border bg-input-fields p-5 text-white transition-colors duration-150',
              open === i ? 'border-line-strong' : 'border-line hover:border-line-strong',
            )}
          >
            <div className="flex items-center justify-between gap-x-2 font-medium">
              {q}
              <ChevronDownIcon className={cn('shrink-0 text-secondary duration-150', open === i ? 'rotate-180' : 'rotate-0')} />
            </div>
            {open === i && <p className="animate-fade text-sm leading-6 text-secondary">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
