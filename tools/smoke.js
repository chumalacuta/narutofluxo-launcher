const {app, BrowserWindow} = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-smoke-'))
app.setPath('userData',testRoot)
process.env.FLUXO_SMOKE_TEST='1'
const failures = []
app.on('web-contents-created', (_, contents) => {
 contents.on('console-message', (event) => { if(event.level === 'error') failures.push(event.message) })
 contents.on('preload-error', (_, file, error) => failures.push(file+': '+error.message))
})
require('../index')
async function waitFor(win, script) {
 const start = Date.now()
 while(Date.now()-start < 30000) {
  try {const value = await win.webContents.executeJavaScript(script); if(value) return value} catch(_) {}
  await new Promise(resolve=>setTimeout(resolve,250))
 }
 throw new Error('Timed out: '+script)
}
app.whenReady().then(async () => {
 const output = path.resolve(__dirname,'../artifacts')
 fs.mkdirSync(output,{recursive:true})
 try {
  let win
  const start=Date.now()
  while(!win && Date.now()-start<15000) {win=BrowserWindow.getAllWindows()[0];if(!win) await new Promise(r=>setTimeout(r,100))}
  if(!win) throw new Error('No launcher window')
  win.webContents.setBackgroundThrottling(false)
  await waitFor(win, "typeof DistroAPI !== 'undefined' && document.getElementById('welcomeButton')")
  await waitFor(win, "document.getElementById('welcomeContainer') && getComputedStyle(document.getElementById('welcomeContainer')).display !== 'none'")
  await waitFor(win, "getComputedStyle(document.getElementById('welcomeContainer')).opacity === '1'")
  await waitFor(win, "getComputedStyle(document.getElementById('loadingContainer')).display === 'none'")
  await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  fs.writeFileSync(path.join(output,'launcher-welcome.png'), (await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript("document.getElementById('welcomeButton').click()")
  await waitFor(win,"getComputedStyle(document.getElementById('loginOptionsContainer')).display !== 'none'")
  await new Promise(r=>setTimeout(r,1100))
  fs.writeFileSync(path.join(output,'launcher-login.png'), (await win.webContents.capturePage()).toPNG())
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const distro = await DistroAPI.getDistribution();
   const c = ConfigManager;
   const a = await require('./assets/js/authmanager').addMojangAccount('FluxoTeste','');
   if(a.type !== 'offline') throw new Error('Offline account type');
   if(!(await require('./assets/js/authmanager').validateSelected())) throw new Error('Account invalid');
   return {server:distro.getMainServer().rawServer.address,mods:distro.getMainServer().modules.filter(m=>m.rawModule.artifact.path?.startsWith('mods/')).length,nick:a.displayName,uuid:a.uuid,buttons:Array.from(document.querySelectorAll('#loginOptionsContainer button')).map(b=>b.textContent.trim())};
  })()`)
  const significant=failures.filter(s=> !/Content Security Policy|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|net::|404|503|ERR_FILE_NOT_FOUND/.test(s))
  if(significant.length) throw new Error(significant.join('\n'))
  fs.writeFileSync(path.join(output,'smoke-result.json'),JSON.stringify({...result,rendererErrors:failures},null,2))
  console.log('FLUXO_SMOKE_OK '+JSON.stringify(result))
  app.exit(0)
 } catch(error) {console.error('FLUXO_SMOKE_FAILED',error);fs.writeFileSync(path.join(output,'smoke-errors.json'),JSON.stringify(failures,null,2));app.exit(1)}
})
