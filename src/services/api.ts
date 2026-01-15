import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Category, FeedResponse, UserStats } from '../types';

// Backend API URL - use EXPO_PUBLIC_API_BASE for device access in dev
const API_BASE = __DEV__
  ? (process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3001/api')
  : 'https://api.swipestreet.app/api';

class ApiService {
  private token: string | null = null;

  async init() {
    this.token = await AsyncStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

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
    await AsyncStorage.setItem('auth_token', result.token);
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

  async deleteAccount(): Promise<void> {
    await this.request('/auth/me', { method: 'DELETE' });
    await AsyncStorage.removeItem('auth_token');
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

  // ============ CHAT ============

  async chat(card: Card, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<{ message: string }> {
    return this.request('/chat/message', {
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
    });
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
