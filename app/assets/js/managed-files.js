const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const {safePath} = require('./bundle-server')

// Only files explicitly managed by this launcher may leave the mods folder.
// Removed versions are retained outside the game, rather than deleted.
async function reconcileManagedFiles(bundleRoot, instance, launcherRoot) {
    const manifest = JSON.parse(await fs.readFile(path.join(bundleRoot, 'distribution.json'), 'utf8'))
    const current = []
    function scan(modules) {
        for (const m of modules || []) {
            const file = m.artifact?.path
            if (m.type === 'File' && /^mods\/[^/]+\.jar$/i.test(file || '')) {
                safePath(instance, file)
                current.push(file)
            }
            scan(m.subModules)
        }
    }
    scan(manifest.servers[0].modules)
    const key = crypto.createHash('sha256').update(path.resolve(instance)).digest('hex').slice(0,16)
    const state = path.join(launcherRoot, 'managed-' + key + '.json')
    let previous = []
    try { previous = JSON.parse(await fs.readFile(state, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    const keep = new Set(current)
    for (const file of previous) {
        if (keep.has(file) || !/^mods\/[^/]+\.jar$/i.test(file)) continue
        const source = safePath(instance, file)
        const target = safePath(path.join(launcherRoot, 'mods-anteriores', key, Date.now().toString()), file)
        await fs.mkdir(path.dirname(target), {recursive:true})
        try { await fs.rename(source, target) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    await fs.mkdir(launcherRoot, {recursive:true})
    await fs.writeFile(state + '.tmp', JSON.stringify(current))
    await fs.rename(state + '.tmp', state)
}
module.exports = {reconcileManagedFiles}
