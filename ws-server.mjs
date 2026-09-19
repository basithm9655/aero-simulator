import { WebSocketServer } from 'ws';
const PORT=3001;
const wss=new WebSocketServer({port:PORT});
wss.on('error', err => {
  console.error('WSS error:', err);
});
wss.on('connection', ws => {
  ws.on('error', err => {
    console.warn('WS client error:', err.message);
  });
  ws.on('message', data => {
    for (const peer of wss.clients) {
      if (peer !== ws && peer.readyState === 1) {
        try {
          peer.send(data);
        } catch (e) {}
      }
    }
  });
});
console.log(`CBR VFR-06 phone relay: ws://0.0.0.0:${PORT}`);
