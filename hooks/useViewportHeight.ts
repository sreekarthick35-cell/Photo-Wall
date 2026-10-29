'use client';
import { useEffect, useState } from 'react';

/** Height of the *visible* viewport (shrinks when the on-screen keyboard opens on iOS). */
export function useViewportHeight() {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setH(Math.round(vv?.height ?? window.innerHeight));
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return h;
}
