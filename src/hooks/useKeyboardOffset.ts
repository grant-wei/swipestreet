import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    if (!window.visualViewport) {
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
      return;
    }

    const viewport = window.visualViewport;
    const update = () => {
      const keyboard =
        window.innerHeight - viewport.height - viewport.offsetTop;
      const next = Math.max(0, keyboard);
      setOffset(next);
      document.documentElement.style.setProperty('--keyboard-offset', `${next}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
    };
  }, []);

  return offset;
}
