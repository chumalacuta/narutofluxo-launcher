const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert/strict')
const {safePath, startBundleServer} = require('../app/assets/js/bundle-server')
const {DistributionAPI} = require('helios-core/common')
async function main() {
 const root = path.resolve(__dirname, '../bundle')
 const raw = JSON.parse(fs.readFileSync(path.join(root,'distribution.json')))
 const defaults = JSON.parse(fs.readFileSync(path.join(root,'defaults.json')))
 let count = 0
 function check(v) {
  if (Array.isArray(v)) return v.forEach(check)
  if (!v || typeof v !== 'object') return
  if (v.url && v.url.startsWith('bundle:')) {
   assert.match(v.SHA256, /^[a-f0-9]{64}$/)
   assert.equal(v.url, 'bundle:'+v.SHA256)
   const data = fs.readFileSync(path.join(root, 'objects', v.SHA256))
   assert.equal(data.length, v.size)
   assert.equal(crypto.createHash('sha256').update(data).digest('hex'), v.SHA256)
   assert.equal(crypto.createHash('md5').update(data).digest('hex'), v.MD5)
   if (v.path) safePath(root,v.path)
   count++
  }
  Object.values(v).forEach(check)
 }
 check(raw); check(defaults); check(JSON.parse(fs.readFileSync(path.join(root,'common-defaults.json'))))
 const server = await startBundleServer(root)
 const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fluxo-distro-'))
 try {
  const api = new DistributionAPI(temp,path.join(temp,'common'),path.join(temp,'instances'),server.url,false)
  const distro = await api.getDistribution()
  const target = distro.getMainServer()
  assert.match(target.rawServer.address, /^[^\s:]+:\d+$/)
  assert.equal(target.effectiveJavaOptions.suggestedMajor, 8)
  assert.equal(target.modules.filter(m => m.rawModule.type === 'ForgeHosted').length, 1)
  const sample = target.modules.find(m => m.rawModule.artifact.path?.startsWith('mods/'))
  const downloaded = Buffer.from(await (await fetch(sample.rawModule.artifact.url)).arrayBuffer())
  assert.equal(crypto.createHash('sha256').update(downloaded).digest('hex'), sample.rawModule.artifact.SHA256)
  console.log(JSON.stringify({verifiedArtifacts:count,server:target.rawServer.address,modules:target.modules.length,java:target.effectiveJavaOptions}, null,2))
 } finally {server.server.close();fs.rmSync(temp,{recursive:true,force:true})}
}
main().catch(error => {console.error(error);process.exitCode=1})
