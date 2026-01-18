import * as SecureStore from 'expo-secure-store';
import { Card, Category, FeedResponse, UserStats } from '../types';
import { CommentItem } from './offline';

const AUTH_TOKEN_KEY = 'auth_token';

// Backend API URL - use EXPO_PUBLIC_API_BASE for device access in dev
const API_BASE = __DEV__
  ? (process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3001/api')
  : 'https://api.swipestreet.app/api';

const REQUEST_TIMEOUT = 15000; // 15 seconds

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeout)
    ),
  ]);
}

class ApiService {
  private token: string | null = null;

  async init() {
    this.token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout = REQUEST_TIMEOUT
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetchWithTimeout(
      `${API_BASE}${endpoint}`,
      { ...options, headers },
      timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  // ============ AUTH ============

  async register(deviceId: string): Promise<{ token: string; user_id: string }> {
    const result = await this.request<{ token: string; user_id: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId }),
      }
    );
    this.token = result.token;
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, result.token);
    return result;
  }

  async getProfile(): Promise<{ user: any }> {
    return this.request('/auth/me');
  }

  async updateProfile(data: { name?: string; email?: string; analyst_profile?: any }): Promise<{ user: any }> {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async requestInvestorVerification(data: { work_email: string; linkedin_url: string }): Promise<{ status: string; expires_at: string; debug_code?: string }> {
    return this.request('/auth/investor/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyInvestorCode(code: string): Promise<{ status: string; verified_at: string }> {
    return this.request('/auth/investor/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async deleteAccount(): Promise<void> {
    await this.request('/auth/me', { method: 'DELETE' });
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    this.token = null;
  }

  async exportData(): Promise<any> {
    return this.request('/auth/export');
  }

  // ============ CARDS ============

  async getFeed(options: {
    limit?: number;
    offset?: number;
    category?: string;
  } = {}): Promise<FeedResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));
    if (options.category) params.append('category', options.category);

    return this.request<FeedResponse>(`/cards/feed?${params}`);
  }

  async getCard(cardId: string): Promise<{ card: Card }> {
    return this.request(`/cards/${cardId}`);
  }

  async getCategories(): Promise<{ categories: Category[] }> {
    return this.request<{ categories: Category[] }>('/cards/meta/categories');
  }

  async recordAction(cardId: string, action: 'seen' | 'saved' | 'unsaved' | 'liked' | 'disliked'): Promise<void> {
    await this.request('/cards/action', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId, action }),
    });
  }

  async getSavedCards(): Promise<{ cards: Card[]; total: number }> {
    return this.request<{ cards: Card[]; total: number }>('/cards/user/saved');
  }

  async syncAllCards(): Promise<{ cards: Card[]; synced_at: string }> {
    return this.request<{ cards: Card[]; synced_at: string }>('/cards/sync/all');
  }

  // Legacy methods for compatibility
  async markSeen(cardId: string): Promise<void> {
    await this.recordAction(cardId, 'seen');
  }

  async saveCard(cardId: string): Promise<void> {
    await this.recordAction(cardId, 'saved');
  }

  async unsaveCard(cardId: string): Promise<void> {
    await this.recordAction(cardId, 'unsaved');
  }

  // ============ COMMENTS ============

  async getComments(cardId: string): Promise<{ comments: CommentItem[] }> {
    const params = new URLSearchParams({ card_id: cardId });
    return this.request<{ comments: CommentItem[] }>(`/cards/comments?${params}`);
  }

  async addComment(cardId: string, text: string): Promise<{ comment: CommentItem }> {
    return this.request<{ comment: CommentItem }>('/cards/comments', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId, text }),
    });
  }

  // ============ CHAT ============

  async chat(card: Card, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<{ message: string }> {
    // AI responses can take longer, use 60 second timeout
    return this.request(
      '/chat/message',
      {
        method: 'POST',
        body: JSON.stringify({
          card_id: card.id,
          card: {
            type: card.type,
            content: card.content,
            expanded: card.expanded,
            categories: card.categories,
            tickers: card.tickers,
          },
          messages,
        }),
      },
      60000
    );
  }

  // ============ SUBSCRIPTION ============

  async getSubscriptionStatus(): Promise<{ is_subscribed: boolean; status: string; ends_at: string | null }> {
    return this.request('/subscription/status');
  }

  async createCheckout(plan: 'monthly' | 'yearly'): Promise<{ checkout_url: string }> {
    return this.request('/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  async getPortalUrl(): Promise<{ portal_url: string }> {
    return this.request('/subscription/portal', { method: 'POST' });
  }

  async getPlans(): Promise<{ plans: any[] }> {
    return this.request('/subscription/plans');
  }

  // ============ STATS ============

  async getStats(): Promise<UserStats> {
    return this.request<UserStats>('/stats');
  }

  // ============ ANALYTICS ============

  async trackEvent(eventName: string, properties?: Record<string, any>): Promise<void> {
    await this.request('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ event: eventName, properties }),
    });
  }
}

export const api = new ApiService();
