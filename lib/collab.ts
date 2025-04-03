import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export const createYDoc = (roomName: string) => {
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(
    'wss://your-server.com', 
    roomName,
    ydoc
  )

  return { ydoc, provider }
}
