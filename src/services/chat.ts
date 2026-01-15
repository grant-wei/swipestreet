import { Card } from '../types';
import { api } from './api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function getClaudeResponse(
  messages: Message[],
  card: Card
): Promise<string> {
  try {
    const response = await api.chat(card, messages);
    return response.message;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}
