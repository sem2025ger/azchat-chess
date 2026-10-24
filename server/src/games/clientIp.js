'use strict';
const {isIP}=require('node:net');
function clientIp(req, configuredHops){
  // Do not trust forwarding headers until the owner verifies the proxy chain.
  // This is scoped to game-source rate limiting, never auth or socket handling.
  const hops=Number(configuredHops||0);
  if(!Number.isInteger(hops)||hops<1||hops>8)return req.socket.remoteAddress || 'unknown';
  const chain=String(req.headers['x-forwarded-for']||'').split(',').map(ip=>ip.trim()).filter(Boolean);
  chain.push(req.socket.remoteAddress);
  const chosen=chain[chain.length-1-hops];
  return chosen&&isIP(chosen)?chosen:req.socket.remoteAddress||'unknown';
}
module.exports={clientIp};
