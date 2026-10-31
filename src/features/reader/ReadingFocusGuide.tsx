import { useEffect, useRef, useState } from 'react';

export default function ReadingFocusGuide({ enabled }: { enabled: boolean }) {
  const guideRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const pointerY = useRef(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) {
      visibleRef.current = false;
      setVisible(false);
      return;
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        if (visibleRef.current) { visibleRef.current = false; setVisible(false); }
        return;
      }
      const target = event.target;
      const inReadingArea = target instanceof Element && Boolean(target.closest('.article-main, .split-pane-scroll'));
      if (!inReadingArea) {
        if (visibleRef.current) { visibleRef.current = false; setVisible(false); }
        return;
      }
      pointerY.current = event.clientY;
      if (guideRef.current) guideRef.current.style.top = `${pointerY.current}px`;
      if (!visibleRef.current) { visibleRef.current = true; setVisible(true); }
    };
    const leave = () => {
      if (visibleRef.current) { visibleRef.current = false; setVisible(false); }
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', leave);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('blur', leave); };
  }, [enabled]);
  useEffect(() => {
    if (visible && guideRef.current) guideRef.current.style.top = `${pointerY.current}px`;
  }, [visible]);
  if (!enabled || !visible) return null;
  return <div ref={guideRef} className="reading-focus-guide" aria-hidden="true" />;
}
