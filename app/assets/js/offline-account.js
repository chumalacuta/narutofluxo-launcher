const crypto = require('crypto')
function createOfflineAccount(value) {
 const nick = String(value || '').trim()
 if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) throw new Error('Use um nick de 3 a 16 letras, numeros ou _.')
 const hash = crypto.createHash('md5').update('OfflinePlayer:' + nick, 'utf8').digest()
 hash[6] = (hash[6] & 15) | 48
 hash[8] = (hash[8] & 63) | 128
 const h = hash.toString('hex')
 const uuid = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
 return {uuid, accessToken: '0', username: nick, displayName: nick, type: 'offline'}
}
function migrateOfflineAccounts(database, selected) {
 const accounts = {...database}
 for (const [key, old] of Object.entries(database || {})) {
  if (old.type !== 'offline') continue
  let account
  try { account = createOfflineAccount(old.displayName || old.username) } catch (_) { continue }
  if (accounts[account.uuid] && accounts[account.uuid].type !== 'offline') continue
  delete accounts[key]
  accounts[account.uuid] = {...old, ...account}
  if (selected === key) selected = account.uuid
 }
 return {accounts, selected}
}
module.exports = {createOfflineAccount, migrateOfflineAccounts}
