const {app,BrowserWindow}=require('electron')
const http=require('http'),assert=require('assert/strict')
const {REDIRECT_URI,createRedirectReceiver}=require('../app/assets/js/microsoft-login')
app.whenReady().then(async()=>{
 let server,win
 try{
  const expected='M.R3+sample/code==%2B'
  const location=REDIRECT_URI+'?'+new URLSearchParams({code:expected,state:'fixture-state'})
  server=http.createServer((req,res)=>{res.writeHead(302,{Location:location});res.end()})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}})
  const events=[]
  let deliveries=0
  const result=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('No callback intercepted')),10000)
   const receive=createRedirectReceiver('fixture-state',response=>{deliveries++;clearTimeout(timer);resolve(response)})
   const intercept=(event,uri)=>{events.push(event.type||'navigation');if(receive(event.url||uri))event.preventDefault()}
   win.webContents.on('will-redirect',intercept)
   win.webContents.on('will-navigate',intercept)
   win.webContents.on('did-navigate',(event,uri)=>receive(event.url||uri))
  })
  win.loadURL(`http://127.0.0.1:${server.address().port}/authorize`).catch(()=>{})
  const response=await result
  assert.equal(response.code,expected);assert.equal(deliveries,1)
  console.log('FLUXO_OAUTH_WINDOW_OK '+JSON.stringify({codePreserved:true,deliveries,interceptedBeforePageLoad:true}))
  win.destroy();server.close();app.exit(0)
 }catch(error){console.error(error);win?.destroy();server?.close();app.exit(1)}
})
