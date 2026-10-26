import { useCallback, useEffect, useRef, useState } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

/**
 * IPP-1604 / 1605: topic cards in ONE row, with the legend and the ‹ › arrows on a line above
 * (arrows never cover a card). Arrows (and swipe / trackpad) move it left and right;
 * an arrow only shows when there are more cards on that side. The chosen card is kept in view.
 */
export default function TopicStrip({ selectedKey, legend, children }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update]);

  // Keep the chosen topic visible (e.g. the 8th topic opened from a link)
  useEffect(() => {
    const el = ref.current;
    const card = el?.querySelector('[aria-pressed="true"]');
    if (!card) return;
    const left = card.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + card.offsetWidth > el.scrollLeft + el.clientWidth + 1) {
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [selectedKey]);

  // One page = the visible width + one gap, so whole cards line up again after every click
  const move = (dir) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth + 12), behavior: 'smooth' });
  const arrow =
    'flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-white';
  const scrollable = edges.left || edges.right;

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        {legend}
        {scrollable && (
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <button type="button" onClick={() => move(-1)} disabled={!edges.left} aria-label="Previous topics" className={arrow}>
              <HiChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => move(1)} disabled={!edges.right} aria-label="More topics" className={arrow}>
              <HiChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      <div
        ref={ref}
        aria-label="Topics"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}
