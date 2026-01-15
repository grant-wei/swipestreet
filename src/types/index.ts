export interface Card {
  id: string;
  type: 'insight' | 'prediction' | 'contrarian' | 'number' | 'thesis' | 'stat' | 'mechanic';
  content: string;
  expanded?: string;
  tickers: string[];
  source: string;
  source_title: string;
  categories: string[];
  created_at: string;
}

export interface Category {
  name: string;
  count: number;
}

export interface UserStats {
  cards_seen: number;
  cards_saved: number;
  quiz_attempts: number;
  quiz_accuracy: number;
}

export interface FeedResponse {
  cards: Card[];
  total: number;
  offset: number;
  has_more: boolean;
}
