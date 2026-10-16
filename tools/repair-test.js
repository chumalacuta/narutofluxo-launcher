const fs=require('fs'),path=require('path')
const {startBundleServer,seedDefaults}=require('../app/assets/js/bundle-server')
const {DistributionAPI}=require('helios-core/common')
const {FullRepair,DistributionIndexProcessor,MojangIndexProcessor}=require('helios-core/dl')
async function main(){
 const root=path.resolve(__dirname,'../artifacts/game-test'), common=path.join(root,'common'), instances=path.join(root,'instances'), launcher=path.join(root,'launcher')
 fs.mkdirSync(launcher,{recursive:true})
 const bundle=await startBundleServer(path.resolve(__dirname,'../bundle'))
 const id='NarutoFluxo-1.7.10'
 const repair=new FullRepair(common,instances,launcher,id,false)
 try{
  const api=new DistributionAPI(launcher,common,instances,bundle.url,false)
  const distro=await api.getDistribution()
  await seedDefaults(path.resolve(__dirname,'../bundle'),path.join(instances,id));await seedDefaults(path.resolve(__dirname,'../bundle'),common,'common-defaults.json',false)
  repair.spawnReceiver()
  let count=await repair.verifyFiles(()=>{})
  console.log('NEEDS_DOWNLOAD',count)
  if(count) await repair.download(()=>{})
  count=await repair.verifyFiles(()=>{})
  if(count) throw new Error(count+' files still invalid')
  const dp=new DistributionIndexProcessor(common,distro,id), mp=new MojangIndexProcessor(common,'1.7.10')
  await dp.init();await mp.init()
  fs.writeFileSync(path.join(root,'manifests.json'),JSON.stringify({forge:await dp.loadModLoaderVersionJson(),vanilla:await mp.getVersionJson()}))
  console.log('FLUXO_REPAIR_OK')
 }finally{if(repair.childProcess?.connected)repair.destroyReceiver();bundle.server.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
