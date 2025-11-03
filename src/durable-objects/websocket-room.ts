export class WebSocketRoom implements DurableObject {
  state: DurableObjectState
  sessions: Map<string, WebSocket>

  constructor(state: DurableObjectState) {
    this.state = state
    this.sessions = new Map()
  }

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get('Upgrade') || ''
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    await this.handleSession(server, request)

    return new Response(null, { status: 101, webSocket: client })
  }

  async handleSession(ws: WebSocket, request: Request) {
    const id = crypto.randomUUID()
    ws.accept()

    this.sessions.set(id, ws)
    this.broadcast(JSON.stringify({ type: 'join', id, count: this.sessions.size }))

    ws.addEventListener('message', (evt) => {
      try {
        const data = typeof evt.data === 'string' ? evt.data : ''
        if (data) this.broadcast(data)
      } catch {}
    })

    const close = () => {
      this.sessions.delete(id)
      this.broadcast(JSON.stringify({ type: 'leave', id, count: this.sessions.size }))
    }

    ws.addEventListener('close', close)
    ws.addEventListener('error', close)
  }

  broadcast(message: string) {
    for (const ws of this.sessions.values()) {
      try { ws.send(message) } catch {}
    }
  }
}