const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
function safePath(root, relative) {
 if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.posix.isAbsolute(relative) || relative.split('/').some(p => p === '..' || p.includes(':'))) throw new Error('Invalid bundle path')
 const resolved = path.resolve(root, relative)
 if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('Path outside instance')
 return resolved
}
function rewriteArtifacts(value, base, hashes) {
 if (Array.isArray(value)) return value.map(v => rewriteArtifacts(v, base, hashes))
 if (value && typeof value === 'object') {
  const out = {}
  for (const [key, item] of Object.entries(value)) {
   if (key === 'url' && typeof item === 'string' && item.startsWith('bundle:')) {
    const hash = item.slice(7)
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid object hash')
    hashes.add(hash)
    out[key] = base + '/objects/' + hash
   } else out[key] = rewriteArtifacts(item, base, hashes)
  }
  return out
 }
 return value
}
async function startBundleServer(root) {
 const raw = JSON.parse(await fs.promises.readFile(path.join(root, 'distribution.json'), 'utf8'))
 const token = crypto.randomBytes(32).toString('hex')
 const hashes = new Set()
 let manifest
 const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end() }
  if (req.url === '/' + token + '/distribution.json') {
   res.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': manifest.length, 'Cache-Control': 'no-store'})
   return res.end(req.method === 'HEAD' ? undefined : manifest)
  }
  const match = req.url.match(new RegExp('^/' + token + '/objects/([a-f0-9]{64})$'))
  if (!match || !hashes.has(match[1])) { res.writeHead(404); return res.end() }
  const file = path.join(root, 'objects', match[1])
  fs.stat(file, (error, stat) => {
   if (error || !stat.isFile()) { res.writeHead(404); return res.end() }
   res.writeHead(200, {'Content-Type': 'application/octet-stream', 'Content-Length': stat.size})
   if (req.method === 'HEAD') return res.end()
   const stream = fs.createReadStream(file)
   stream.on('error', () => res.destroy())
   stream.pipe(res)
  })
 })
 await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
 const base = `http://127.0.0.1:${server.address().port}/${token}`
 manifest = Buffer.from(JSON.stringify(rewriteArtifacts(raw, base, hashes)))
 return {server, url: base + '/distribution.json'}
}
async function seedDefaults(root, instance, index = 'defaults.json', preserve = true) {
 const defaults = JSON.parse(await fs.promises.readFile(path.join(root, index), 'utf8'))
 for (const entry of defaults) {
  const target = safePath(instance, entry.path)
  if (!/^[a-f0-9]{64}$/.test(entry.SHA256)) throw new Error('Invalid default hash')
  const data = await fs.promises.readFile(path.join(root, 'objects', entry.SHA256))
  if (crypto.createHash('sha256').update(data).digest('hex') !== entry.SHA256) throw new Error('Damaged default: ' + entry.path)
  if (!preserve) {
   try {
    const existing = await fs.promises.readFile(target)
    if (crypto.createHash('sha256').update(existing).digest('hex') === entry.SHA256) continue
   } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  await fs.promises.mkdir(path.dirname(target), {recursive: true})
  try { await fs.promises.writeFile(target, data, {flag: preserve ? 'wx' : 'w'}) } catch (error) { if (error.code !== 'EEXIST') throw error }
 }
}
module.exports = {startBundleServer, safePath, seedDefaults}
