import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(process.argv[2]||'release/performance-candidate');
createServer(async(req,res)=>{try{
 let path=new URL(req.url,'http://localhost').pathname;if(path==='/')path='/index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root))throw Error();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.statusCode=404;res.end();}}).listen(Number(process.argv[3]||5194),'127.0.0.1',()=>console.log('Serving',root));
