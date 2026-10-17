// TCP connection from the developer machine, held by the dev server (bridge.js)
// onData(bytes) per received chunk, onClose(reason) when the connection ends; send() before the page is connected is dropped
export function useTCP({ host = '127.0.0.1', port }, onData, onClose) {
  const query = new URLSearchParams({ proto: 'tcp', host, port })
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/network?${query}`)
  ws.binaryType = 'arraybuffer'
  ws.onmessage = ({ data }) => onData(new Uint8Array(data))
  ws.onclose = (e) => onClose?.(e.reason)

  return {
    send(bytes) {
      if (ws.readyState === WebSocket.OPEN) ws.send(bytes)
    },
    close: () => ws.close(),
  }
}
