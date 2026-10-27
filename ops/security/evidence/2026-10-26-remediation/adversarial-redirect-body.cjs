'use strict';
// Loopback only. Demonstrates whether discarded response bodies outlive policy budgets.
const path=require('node:path');
const http=require('node:http');
const root=process.argv[2]||process.cwd();
const {fetchResource,approvedOrigins}=require(path.join(root,'a11y-audit/scripts/network-policy'));
(async()=>{
 let origin;let sent=0;let streamClosed=false;let timer;
 const server=http.createServer((req,res)=>{
  if(req.url==='/redirect'){
   res.writeHead(302,{location:'/ok'});res.flushHeaders();timer=setInterval(()=>{res.write('x'.repeat(100));sent+=100;},5);res.on('close',()=>{streamClosed=true;clearInterval(timer)});
  }else{res.end('ok')}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
 const start=Date.now();const result=await fetchResource(origin+'/redirect',{allowedOrigins:approvedOrigins(origin),timeoutMs:30,maxBytes:10});
 await new Promise(r=>setTimeout(r,150));
 console.log(JSON.stringify({result,elapsed:Date.now()-start,redirectBodyBytesSent:sent,redirectStreamClosed:streamClosed}));
 server.closeAllConnections();await new Promise(r=>server.close(r));clearInterval(timer);
})().catch(e=>{console.error(e);process.exitCode=1});
