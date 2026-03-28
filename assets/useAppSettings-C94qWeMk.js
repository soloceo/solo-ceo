import{c as h}from"./index-7OSAogSY.js";import{a as o}from"./vendor-cmdk-CmCZ0KWF.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],M=h("pen",f);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],T=h("trash-2",y);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],_=h("x",m);let t=null,c=0,a=null;const g=1e4;async function S(){return t&&Date.now()-c<g?t:a||(a=fetch("/api/settings").then(e=>e.json()).then(e=>(t=e,c=Date.now(),a=null,e)).catch(e=>{throw a=null,e}),a)}function C(){t=null,c=0}function b(){const[e,r]=o.useState(t),[l,u]=o.useState(!!t),i=o.useCallback(async()=>{try{const n=await S();r(n),u(!0)}catch{}},[]);o.useEffect(()=>{i()},[i]);const p=o.useCallback(async(n,s)=>{await fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({[n]:s})}),t=t?{...t,[n]:s}:{[n]:s},c=Date.now(),r(d=>d?{...d,[n]:s}:{[n]:s})},[]);return{settings:e,loaded:l,save:p,reload:i}}export{M as P,T,_ as X,C as i,b as u};
