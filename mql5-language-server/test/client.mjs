import { spawn } from 'node:child_process';
export function client(script = 'src/server.mjs', timeoutMs = 10_000) {
  const child=spawn(process.execPath,[script],{stdio:['pipe','pipe','pipe']});
  let buffer=Buffer.alloc(0),id=0,errors=''; const waiting=new Map(), notifications=[];
  child.stderr.on('data',data=>errors+=data);
  child.stdout.on('data',data=>{
    buffer=Buffer.concat([buffer,data]);
    while(true){
      const at=buffer.indexOf('\r\n\r\n');if(at<0)return;
      const length=Number(/Content-Length:\s*(\d+)/i.exec(buffer.subarray(0,at).toString())[1]);
      if(buffer.length<at+4+length)return;
      const msg=JSON.parse(buffer.subarray(at+4,at+4+length));buffer=buffer.subarray(at+4+length);
      if(Object.hasOwn(msg,'id')){const done=waiting.get(msg.id);waiting.delete(msg.id);done?.(msg);}
      else notifications.push(msg);
    }
  });
  function send(method,params,id,fragment=false){
    const body=Buffer.from(JSON.stringify({jsonrpc:'2.0',method,params,...(id===undefined?{}:{id})}));
    const data=Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),body]);
    if(fragment){child.stdin.write(data.subarray(0,17));child.stdin.write(data.subarray(17));}else child.stdin.write(data);
  }
  return {child,notifications,get errors(){return errors;},notify:(method,params)=>send(method,params),
    request:async(method,params,fragment=false)=>{
      const number=++id;
      const timeout=setTimeout(()=>{waiting.get(number)?.({error:{message:'Request timed out'}});waiting.delete(number);},timeoutMs);
      const answer=await new Promise(resolve=>{waiting.set(number,resolve);send(method,params,number,fragment);});
      clearTimeout(timeout);if(answer.error)throw new Error(answer.error.message);return answer.result;
    },
    close:async()=>{await new Promise(resolve=>{child.once('exit',resolve);send('exit');});}
  };
}
