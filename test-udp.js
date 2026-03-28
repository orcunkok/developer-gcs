import dgram from "dgram";
const s = dgram.createSocket("udp4");
s.bind(14550);
s.on("message", (buf) => console.log(`got ${buf.length} bytes`));
console.log("listening on 14550...");
