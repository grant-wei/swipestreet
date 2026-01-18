export interface Card {
  id: string;
  type: 'insight' | 'prediction' | 'contrarian' | 'number' | 'thesis' | 'stat' | 'mechanic' | 'lesson' | 'pattern' | 'framework' | 'idea' | 'setup' | 'catalyst' | 'outcome' | 'takeaway';
  content: string;
  expanded?: string;
  tickers: string[];
  source: string;
  source_title: string;
  categories: string[];
  created_at: string;
  price_history_3y?: number[];
  company_name?: string;
  gics_sector?: string;
  gics_industry_group?: string;
  gics_industry?: string;
  gics_sub_industry?: string;
  case_study_id?: string;  // Reference to parent case study
  card_order?: number;     // Order within case study (1, 2, 3, 4)
}

export interface CaseStudy {
  id: string;
  title: string;              // "The AIG Turnaround"
  company: string;            // "American International Group"
  ticker: string;             // "AIG"
  description: string;        // Brief hook/teaser
  cards: Card[];              // 3-5 cards in narrative order
  categories: string[];       // ["Capital Allocation", "Cycles"]
  created_at: string;
  cover_image?: string;       // Optional cover image URL
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
