const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export interface ChatResponse {
  response: string
  conversationId: string
  messageCount: number
  model: string
  provider: string
}

export async function sendMessage(
  message: string,
  conversationId: string | null
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      ...(conversationId && { conversationId }),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || 'Failed to send message')
  }

  return response.json()
}
