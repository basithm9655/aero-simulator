import { spawn } from 'node:child_process';
const vite=spawn(process.platform==='win32'?'npx.cmd':'npx',['vite','--host','0.0.0.0','--port','4173'],{stdio:'inherit'});
const ws=spawn(process.execPath,['ws-server.mjs'],{stdio:'inherit'});
const stop=()=>{vite.kill('SIGTERM');ws.kill('SIGTERM');};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
