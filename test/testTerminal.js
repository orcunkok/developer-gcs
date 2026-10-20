import { createInterface } from 'node:readline'

// lines typed in the dev server terminal run as gcs commands in the browser, e.g. `takeoff 1 10`
export default function terminal() {
    return {
        name: 'gcs-terminal',
        configureServer(server) {
            createInterface({ input: process.stdin }).on('line', (line) => {
                // also accepts console style: swarm(1,2,3), gcs.takeoff(1, 10)
                const [name = '', ...args] = line
                    .replace(/^\s*gcs\./, '')
                    .split(/[\s,()]+/)
                    .filter(Boolean)
                if (name.length < 2) return // empty, or one of Vite's own single-letter shortcuts (r, u, o, c, q, h)
                if (!server.ws.clients.size) return console.log('gcs: no browser connected')
                server.ws.send('gcs:cmd', { name, args })
            })
            server.ws.on('gcs:out', (text) => console.log(`gcs: ${text}`))
        },
    }
}
