// WebVPN conversion adapted from scansci-pdf sources/instsci.py (Apache-2.0).
// Ported to Node; adds exact-host detection, validation and idempotent routing.
// See vendor/scansci/SOURCE.md for the pinned source and retained license.
import {createCipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isIP} from 'node:net';
import {publicAddress as publicIp} from './public-fetch.js';

const schools = Object.values(JSON.parse(readFileSync(new URL('../vendor/scansci/webvpn.json', import.meta.url),'utf8'))).flatMap(province=>Object.entries(province).map(([name,config])=>({name,...config})));
export function publicAddress(value) {
  const url = new URL(value), host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password ||
      (isIP(host) ? !publicIp(host) : !host.includes('.') || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(host))) throw Error('Use a public institution or publisher HTTP(S) address.');
  return url.href;
}
export function validInstitution(input={}) {
  return {portalUrl:publicAddress(String(input.portalUrl||'')).replace(/%7Burl%7D/gi,'{url}'),
    method:['auto','webvpn','ezproxy','publisher'].includes(input.method)?input.method:'auto', school:String(input.school||'').slice(0,160)};
}
export function routeInstitution(input) {
  const config=validInstitution(input), target=publicAddress(input.targetUrl), portal=new URL(config.portalUrl), url=new URL(target);
  const school=schools.find(item=>{try{return new URL(item.host.startsWith('http')?item.host:'https://'+item.host).hostname===portal.hostname;}catch{return false;}});
  const method=config.method==='auto' ? (school && (!school.type || school.type==='webvpn') ? 'webvpn' : config.portalUrl.includes('{url}') ? 'ezproxy' : 'publisher') : config.method;
  if(method==='webvpn' && (!school || school.type && school.type!=='webvpn')) throw Error('This gateway has no verified WebVPN routing configuration. Use the institution or publisher sign-in window.');
  if (url.hostname===portal.hostname) return {url:target, method, school:school?.name||config.school};
  if (method==='webvpn') {
    const key=Buffer.from(school?.crypto_key||'wrdvpnisthebest!'), iv=Buffer.from(school?.crypto_iv||school?.crypto_key||'wrdvpnisthebest!');
    if (![16,24,32].includes(key.length)||iv.length!==16) throw Error('Unsupported institution WebVPN encryption configuration.');
    const cipher=createCipheriv('aes-'+key.length*8+'-cfb',key,iv);
    const encoded=iv.toString('hex')+Buffer.concat([cipher.update(url.hostname,'utf8'),cipher.final()]).toString('hex');
    const scheme=url.protocol.slice(0,-1)+(url.port?'-'+url.port:'');
    return {url:portal.origin+'/'+scheme+'/'+encoded+url.pathname+url.search,method,school:school?.name||config.school};
  }
  if (method==='ezproxy') {
    if(!config.portalUrl.includes('{url}')) throw Error('An EZProxy login URL must contain the {url} target placeholder.');
    const template=config.portalUrl;
    const encoded=template.indexOf('?')>=0 && template.indexOf('{url}')>template.indexOf('?') ? encodeURIComponent(target) : target;
    return {url:template.replaceAll('{url}',encoded),method,school:school?.name||config.school};
  }
  // A library homepage does not create a proxy. Direct publisher access only
  // uses entitlements already established in the application's browser session.
  return {url:target,method:'publisher',school:school?.name||config.school};
}
