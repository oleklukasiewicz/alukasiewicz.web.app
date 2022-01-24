let isNumber=e=>"number"==typeof e&&!isNaN(e-e);const transformsMap={serverTimestamp:["setToServerValue"],increment:["increment",isNumber],max:["maximum",isNumber],min:["minimum",isNumber],appendToArray:["appendMissingElements",Array.isArray],removeFromArray:["removeAllFromArray",Array.isArray]};class Transform{constructor(e,t){if(!(e in transformsMap))throw Error(`Invalid transform name: "${e}"`);const[r,n]=transformsMap[e];if(n&&!n(t))throw Error(`The value for the transform "${e}" needs to be a${n===isNumber?" number":"n array"}.`);n===Array.isArray?this[r]=encodeValue(t).arrayValue:this[r]="serverTimestamp"===e?"REQUEST_TIME":encodeValue(t)}}class Transaction{constructor(e){this.db=e,this.writes=[],this.preconditions={}}write(e,t,r={}){if("object"!=typeof t)throw Error("The data argument is missing");const n=[],o=`${this.db.rootPath}/${getPathFromRef(e)}`,s=this.preconditions[o],i=encode(e instanceof Document?e:t,n);r={},s&&(r.currentDocument=s),i.name=o,this.writes.push({update:i,...r}),n.length&&this.writes.push({transform:{document:i.name,fieldTransforms:n}})}async get(e){const t=await this.db.batchGet(e);return t.forEach(e=>{const{name:t,updateTime:r}=e.__meta__||{name:e.__missing__};this.preconditions[t]=r?{updateTime:r}:{exists:!1}}),t}set(e,t,r={}){restrictTo("doc",e),this.write(e,t,r)}update(e,t,r={}){restrictTo("doc",e),this.write(e,t,{exists:!0,updateMask:!0,...r})}async commit(){this.preconditions={},await this.db.fetch(this.db.endpoint+":commit",{method:"POST",body:JSON.stringify({writes:this.writes})})}}let trimPath=e=>e.trim().replace(/^\/?/,"").replace(/\/?$/,""),isPath=(e,t)=>"string"==typeof t&&""!==t&&trimPath(t).split("/").length%2==("doc"===e?0:1),isRefType=e=>e instanceof Reference||e instanceof Document||"string"==typeof e;function getPathFromRef(e){let t,r,n,o;if(!isRefType(e))throw TypeError("Expected a Reference, Document or a path but got something else");return null!==(o=null!==(n=null===(r=null===(t=e)||void 0===t?void 0:t.__meta__)||void 0===r?void 0:r.path)&&void 0!==n?n:e.path)&&void 0!==o?o:trimPath(e)}function restrictTo(e,t){const r="doc"===e,n=getPathFromRef(t);if(!isPath(e,n))throw TypeError(`You are trying to access a method reserved for ${r?"Documents":"Collections"} with a ${r?"Collection":"Document"}`);return n}function objectToQuery(e={},t){const r=[],n=encodeURIComponent;for(const o in e){if(void 0===e[o])continue;const s=t?`${t}.${o}`:o;if(Array.isArray(e[o]))e[o].forEach(e=>{r.push(`${s}=${n(e)}`)});else if("object"!=typeof e[o])r.push(`${s}=${n(e[o])}`);else{const t=objectToQuery(e[o],s);t&&r.push(t)}}return(!t&&r.length?"?":"")+r.join("&")}function decodeValue(e,t){const r=Object.keys(e)[0];switch(e=e[r],r){case"integerValue":return Number(e);case"arrayValue":return e.values?e.values.map(e=>decodeValue(e,t)):[];case"mapValue":return decode(e,t);case"timestampValue":return new Date(e);case"referenceValue":return new Reference(e.replace(t.rootPath,""),t);case"geoPointValue":return new GeoPoint(e.latitude,e.longitude);default:return e}}function decode(e,t){if(void 0===t)throw Error('Argument "db" is required but missing');const r={};for(const n in e.fields)r[n]=decodeValue(e.fields[n],t);return r}function encodeValue(e,t,r){const n=Object.prototype.toString.call(e);let o=n.substring(8,n.length-1).toLowerCase()+"Value";switch(o){case"numberValue":e="integerValue"==(o=Number.isInteger(e)?"integerValue":"doubleValue")?String(e):e;break;case"arrayValue":e=e.length?{values:e.map(encodeValue)}:{};break;case"dateValue":o="timestampValue",e=e.toISOString();break;case"objectValue":if(e instanceof Reference||e instanceof GeoPoint)return e.toJSON();o="mapValue",e=encode(e,t,r)}return{[o]:e}}function encode(e,t,r){const n=Object.keys(e);if(0===n.length)return{};const o={fields:{}};for(const s of n){if(void 0===e[s])continue;const n=e[s],i=r?`${r}.${s}`:s;n instanceof Transform?(n.fieldPath=i,t&&t.push(n)):o.fields[s]=encodeValue(n,t,i)}return o}class Document{constructor(e,t){if(void 0===t)throw Error('Argument "db" is required but missing');const{name:r,createTime:n,updateTime:o}=e,s={db:t,name:r,createTime:n,updateTime:o,path:r.replace(t.rootPath,""),id:r.split("/").pop()};Object.defineProperty(this,"__meta__",{value:s}),Object.assign(this,decode(e,t))}}class Reference{constructor(e,t){let r;if(this.db=t,"string"!=typeof e)throw Error('The "path" argument should be a string');e=trimPath(e),this.id=null!==(r=e.split("/").pop())&&void 0!==r?r:"",this.path=e,this.name=`${t.rootPath}/${e}`,this.endpoint=`${t.endpoint}/${e}`,this.isRoot=""===e}get parent(){if(this.isRoot)throw Error("Can't get the parent of root");return new Reference(this.path.replace(/\/?([^\/]+)\/?$/,""),this.db)}get parentCollection(){if(this.isRoot)throw Error("Can't get parent of a root collection");return this.isCollection?new Reference(this.path.replace(/(\/([^\/]+)\/?){2}$|^([^\/]+)$/,""),this.db):this.parent}get isCollection(){return isPath("col",this.path)}child(e){return e=e.replace(/^\/?/,""),new Reference(`${this.path}/${e}`,this.db)}async transact(e,t,r={}){const n=this.db.transaction(),o=n[e](this,t,r);return await n.commit().then(()=>o)}async get(e={}){return restrictTo("doc",this),new Document(await this.db.fetch(this.endpoint+objectToQuery({})),this.db)}async set(e,t={}){return restrictTo("doc",this),this.transact("set",e,t)}async update(e,t={}){return restrictTo("doc",this),this.transact("update",e,t)}toJSON(){return{referenceValue:this.name}}}async function handleApiResponse(e){if(!e.ok){const t=await e.json();if(Array.isArray(t))throw 1===t.length?Object.assign(new Error,t[0].error):t;throw Object.assign(new Error,t.error)}return e.json()}class Database{constructor({projectId:e,auth:t,name:r="(default)",host:n="firestore.googleapis.com",ssl:o=!0}){if(void 0===e)throw Error('Database constructor expected the "config" argument to have a valid "projectId" property');this.name=r,this.auth=t,this.rootPath=`projects/${e}/databases/${r}/documents`,this.endpoint=`http${o?"s":""}://${n}/v1/${this.rootPath}`}fetch(e,t){return this.auth&&this.auth.authorizedRequest?this.auth.authorizedRequest(e,t).then(handleApiResponse):fetch(e,t).then(handleApiResponse)}ref(e){return e instanceof Document&&(e=e.__meta__.path),new Reference(e,this)}async batchGet(e){return(await this.fetch(this.endpoint+":batchGet",{method:"POST",body:JSON.stringify({documents:e.map(e=>{const t=restrictTo("doc",e);return`${this.rootPath}/${t}`})})})).map(e=>e.found?new Document(e.found,this):Object.defineProperty({},"__missing__",{value:e.missing}))}transaction(){return new Transaction(this)}}const config={projectId:"portfolio-13301",analitycs:"/app/analitycs",beta:"/app/beta"};let firebase=new Database({projectId:config.projectId});async function incrementVisitors(e,t=!1){try{let r=firebase.ref(e),n=(await r.get()).visitors;await r.set({visitors:n+=1})}catch{t&&firebase.ref(e).set({visitors:1})}}incrementVisitors(config.analitycs);