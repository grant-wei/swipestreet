import { useEffect, useRef } from 'react';
import { Card } from '../types';
import { useStore } from '../stores/useStore';

type EngagementSurface = 'for_you' | 'learn' | 'ideas';

export function useCardEngagement(card: Card | undefined, surface: EngagementSurface) {
  const recordEngagement = useStore((state) => state.recordEngagement);
  const activeCardRef = useRef<Card | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const prevCard = activeCardRef.current;
    const prevStart = startRef.current;
    if (prevCard && prevStart) {
      const durationMs = Date.now() - prevStart;
      void recordEngagement(prevCard, 'dwell', { durationMs, surface });
    }

    if (card) {
      void recordEngagement(card, 'impression', { surface });
      activeCardRef.current = card;
      startRef.current = Date.now();
    } else {
      activeCardRef.current = null;
      startRef.current = null;
    }
  }, [card?.id, recordEngagement, surface]);

  useEffect(() => {
    return () => {
      const prevCard = activeCardRef.current;
      const prevStart = startRef.current;
      if (prevCard && prevStart) {
        const durationMs = Date.now() - prevStart;
        void recordEngagement(prevCard, 'dwell', { durationMs, surface });
      }
    };
  }, [recordEngagement, surface]);
}
