const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path'),os=require('os')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-boot-')))
process.env.FLUXO_SMOKE_TEST='1'
require('../index')
app.whenReady().then(async()=>{
 try{
  let win
  for(let i=0;i<200;i++){
   win=BrowserWindow.getAllWindows()[0]
   try{if(win && await win.webContents.executeJavaScript("typeof ConfigManager !== 'undefined' && !!ConfigManager.getSelectedServer() && typeof ensureJavaSettings === 'function'")) break}catch(_){}
   await new Promise(r=>setTimeout(r,100))
  }
  const gameRoot=path.resolve(__dirname,'../artifacts/game-test')
  const code=`(async()=>{
   const fs=require('fs'),path=require('path');const gameRoot=${JSON.stringify(gameRoot)};
   ConfigManager.setDataDirectory(gameRoot);
   DistroAPI.commonDir=ConfigManager.getCommonDirectory();DistroAPI.instanceDir=ConfigManager.getInstanceDirectory();
   const distro=await DistroAPI.refreshDistributionOrFallback();syncModConfigurations(distro);ensureJavaSettings(distro);
   const server=distro.getMainServer(),id=server.rawServer.id;
   ConfigManager.setJavaExecutable(id,'C:/Program Files/Zulu/zulu-8/bin/java.exe');
   ConfigManager.setMinRAM(id,'2G');ConfigManager.setMaxRAM(id,'4G');ConfigManager.setAutoConnect(false);ConfigManager.setLaunchDetached(false);
   const manifests=JSON.parse(fs.readFileSync(path.join(gameRoot,'manifests.json')));
   const user=require('./assets/js/offline-account').createOfflineAccount('FluxoTeste');
   const PB=require('./assets/js/processbuilder');
   const child=new PB(server,manifests.vanilla,manifests.forge,user,'2.2.2').build();
   return await new Promise(resolve=>{
    const log=fs.createWriteStream(path.join(gameRoot,'boot.log'));
    let done=false,all='',loaded=false,atlas=false,sound=false;
    function finish(ok,reason){if(done)return;done=true;clearTimeout(timeout);log.end();child.kill();resolve({ok,reason,exitTail:all.slice(-5000)})}
    const timeout=setTimeout(()=>finish(false,'boot timeout'),150000);
    child.on('error',e=>finish(false,e.message));child.on('close',code=>finish(false,'early exit '+code));
    for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log.write(data);all=(all+data).slice(-12000);loaded=loaded||/successfully loaded/.test(all);atlas=atlas||/Created:.*-atlas/.test(all);sound=sound||/Sound engine started/.test(all);if(loaded&&atlas&&sound)finish(true,'Forge loaded all mods, textures and sound engine');});
   });
  })()`
  const result=await win.webContents.executeJavaScript(code)
  fs.writeFileSync(path.join(gameRoot,'boot-result.json'),JSON.stringify(result,null,2))
  console.log('FLUXO_BOOT_RESULT '+JSON.stringify(result));app.exit(result.ok?0:1)
 }catch(e){console.error(e);app.exit(1)}
})
