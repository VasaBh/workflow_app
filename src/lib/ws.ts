const BASE_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export function createRunWebSocket(runId: string, onMessage: (data: unknown) => void) {
  const ws = new WebSocket(`${BASE_WS_URL}/v1/ws/${runId}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // ignore parse errors
    }
  };
  return ws;
}

export function createNotificationWebSocket(token: string, onMessage: (data: unknown) => void) {
  const ws = new WebSocket(`${BASE_WS_URL}/v1/ws?token=${token}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // ignore
    }
  };
  return ws;
}
