// UDP socket on the developer machine, held by the dev server (bridge.js); IPv4 only
// listens on address:port (port 0 picks a free one); broadcast: true allows sending to 255.255.255.255 or a subnet broadcast
// onData(bytes, host, port) per datagram, onClose(reason) when the socket ends; send() before it opens is dropped, like UDP
export function useUDP({ port = 0, address = '0.0.0.0', broadcast = false }, onData, onClose) {
  const query = new URLSearchParams({ proto: 'udp', port, address, broadcast: broadcast ? 1 : 0 })
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/network?${query}`)
  ws.binaryType = 'arraybuffer'
  ws.onclose = (e) => onClose?.(e.reason)

  // each message is the peer's IPv4 (4 bytes) and port (2 bytes, big-endian), then the datagram
  // host strings are rebuilt only when the peer changes, not per datagram
  let fromIp = -1
  let fromHost = ''
  ws.onmessage = ({ data }) => {
    const b = new Uint8Array(data)
    const ip = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
    if (ip !== fromIp) {
      fromIp = ip
      fromHost = `${b[0]}.${b[1]}.${b[2]}.${b[3]}`
    }
    onData(b.subarray(6), fromHost, (b[4] << 8) | b[5])
  }

  let toHost = ''
  let toIp = []
  return {
    send(bytes, host, port) {
      if (ws.readyState !== WebSocket.OPEN) return
      if (host !== toHost) {
        toHost = host
        toIp = host.split('.').map(Number)
      }
      const frame = new Uint8Array(6 + bytes.length)
      frame.set(toIp)
      frame[4] = port >> 8
      frame[5] = port & 0xff
      frame.set(bytes, 6)
      ws.send(frame)
    },
    close: () => ws.close(),
  }
}
