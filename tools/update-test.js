const {app}=require('electron'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-feed-test-')))
const {NsisUpdater}=require('electron-updater')
const {ElectronHttpExecutor}=require('electron-updater/out/electronHttpExecutor')
const testDirectory=app.getPath('userData')
const adapter={version:'0.0.0',name:'Fluxo update verification',isPackaged:true,userDataPath:testDirectory,baseCachePath:testDirectory,appUpdateConfigPath:path.resolve(__dirname,'../dist/win-unpacked/resources/app-update.yml'),whenReady:()=>app.whenReady(),quit:()=>{},relaunch:()=>{},onQuit:()=>{}}
const autoUpdater=new NsisUpdater(null,adapter)
autoUpdater.httpExecutor=new ElectronHttpExecutor(()=>{})
let available=false
autoUpdater.once('update-available',()=>{available=true})
autoUpdater.forceDevUpdateConfig=true
autoUpdater.autoDownload=false
autoUpdater.autoInstallOnAppQuit=false
const feed=require('../fluxo-settings.json').updateFeed
autoUpdater.setFeedURL({provider:'generic',url:feed})
app.whenReady().then(async()=>{
 try{
  const result=await autoUpdater.checkForUpdates()
  assert.equal(result.updateInfo.version,require('../package.json').version);assert.equal(available,true)
  const expected=require('js-yaml').load(fs.readFileSync(path.resolve(__dirname,'../dist/latest.yml'),'utf8'))
  assert.equal(result.updateInfo.files[0].sha512,expected.files[0].sha512)
  const url=new URL(result.updateInfo.files[0].url,feed+'/').href
  const got=require('got')
  const response=await got.head(url)
  assert.equal(Number(response.headers['content-length']),expected.files[0].size)
  const map=await got.head(url+'.blockmap')
  assert.equal(map.statusCode,200)
  fs.writeFileSync(path.resolve(__dirname,'../artifacts/update-result.json'),JSON.stringify({simulatedPreviousVersion:'0.0.0',updateAvailable:available,version:result.updateInfo.version,url,size:Number(response.headers['content-length']),checksum:'verified',blockmap:map.statusCode},null,2))
  console.log('FLUXO_UPDATE_OK');app.exit(0)
 }catch(e){console.error(e);app.exit(1)}
})
