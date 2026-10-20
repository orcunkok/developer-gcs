import dgram from 'node:dgram'
import net from 'node:net'
import { WebSocketServer } from 'ws'

// Vite dev server plugin (runs in Node, not the page): holds the developer machine's UDP/TCP sockets for useUDP/useTCP
// one WebSocket per socket at /network; TCP messages are raw bytes,
// UDP messages start with the peer's IPv4 address (4 bytes) and port (2 bytes, big-endian), then the datagram
export default function bridge() {
    return {
        name: 'network-bridge',
        apply: 'serve',
        configureServer(server) {
            const wss = new WebSocketServer({ noServer: true })
            server.httpServer?.on('upgrade', (req, socket, head) => {
                const url = new URL(req.url, 'http://localhost')
                if (url.pathname !== '/network') return // Vite's own HMR socket
                if (new URL(req.headers.origin ?? 'http://none').host !== req.headers.host) return socket.destroy() // only pages served here
                const open = url.searchParams.get('proto') === 'tcp' ? tcp : udp
                wss.handleUpgrade(req, socket, head, (ws) => open(ws, url.searchParams))
            })
        },
    }
}

function udp(ws, params) {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true }) // reuseAddr: several listeners can share a broadcast port
    let peer = '' // last sender, so its address bytes are parsed once, not per datagram
    const header = Buffer.alloc(4)

    socket.on('message', (data, { address, port }) => {
        if (address !== peer) {
            peer = address
            address.split('.').forEach((n, i) => (header[i] = n))
        }
        const frame = Buffer.allocUnsafe(6 + data.length)
        header.copy(frame)
        frame.writeUInt16BE(port, 4)
        data.copy(frame, 6)
        ws.send(frame)
    })
    socket.on('error', (err) => ws.close(1011, err.message.slice(0, 120))) // close reasons max out at 123 bytes
    socket.bind(+params.get('port') || 0, params.get('address') || '0.0.0.0', () => socket.setBroadcast(params.get('broadcast') === '1'))

    let toIp = -1
    let toHost = ''
    ws.on('message', (frame) => {
        const ip = frame.readUInt32BE(0)
        if (ip !== toIp) {
            toIp = ip
            toHost = `${frame[0]}.${frame[1]}.${frame[2]}.${frame[3]}`
        }
        socket.send(frame, 6, frame.length - 6, frame.readUInt16BE(4), toHost)
    })
    ws.on('close', () => {
        try {
            socket.close()
        } catch {} // already closed by a failed bind
    })
}

function tcp(ws, params) {
    const socket = net.connect(+params.get('port'), params.get('host') || '127.0.0.1')
    let error = null
    socket.setNoDelay(true) // send small MAVLink frames immediately, no Nagle batching
    socket.on('data', (data) => ws.send(data))
    socket.on('error', (err) => (error = err))
    socket.on('close', () => ws.close(error ? 1011 : 1000, error?.message.slice(0, 120)))

    ws.on('message', (data) => socket.write(data)) // buffered by Node until connected
    ws.on('close', () => socket.destroy())
}
