import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
const folder=new URL('../output/',import.meta.url),file=new URL('metrics-admin.local.json',folder);
await mkdir(folder,{recursive:true});
try{await access(file);console.log('Existing local metrics credentials preserved.');}
catch{await writeFile(file,JSON.stringify({ADMIN_TOKEN:randomBytes(32).toString('base64url'),INSTALL_SALT:randomBytes(32).toString('base64url')},null,2),{mode:0o600,flag:'wx'});console.log('Metrics credentials generated locally; values are not printed.');}
