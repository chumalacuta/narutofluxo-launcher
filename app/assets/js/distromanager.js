const {DistributionAPI} = require('helios-core/common')
const {ipcRenderer} = require('electron')
const {app} = require('@electron/remote')
const path = require('path')
const ConfigManager = require('./configmanager')
const {seedDefaults} = require('./bundle-server')
const settings = require('../../../fluxo-settings.json')
exports.REMOTE_DISTRO_URL = ipcRenderer.sendSync('fluxo:bundle-url')
if (!exports.REMOTE_DISTRO_URL) throw new Error('Pacote local indisponivel. Reinstale o Fluxo Launcher.')
const api = new DistributionAPI(ConfigManager.getLauncherDirectory(), null, null, exports.REMOTE_DISTRO_URL, false)
const getDistribution = api.getDistribution.bind(api)
let seeded
api.getDistribution = async (...args) => {
 if (!seeded) {
  const root = app.isPackaged ? path.join(process.resourcesPath, 'bundle') : path.resolve(__dirname, '../../..', 'bundle')
  const instance = path.join(ConfigManager.getInstanceDirectory(), settings.serverId)
  seeded = (async () => {
   await seedDefaults(root, instance)
   await seedDefaults(root, ConfigManager.getCommonDirectory(), 'common-defaults.json', false)
   await require('./managed-files').reconcileManagedFiles(root, instance, ConfigManager.getLauncherDirectory())
  })()
 }
 await seeded
 return getDistribution(...args)
}
exports.DistroAPI = api
