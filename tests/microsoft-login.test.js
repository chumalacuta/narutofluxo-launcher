const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const {createMicrosoftLogin,parseMicrosoftRedirect,createRedirectReceiver,describeMicrosoftFailure,REDIRECT_URI} = require('../app/assets/js/microsoft-login')

test('OAuth callback preserves reserved characters, Unicode, padding and literal percent escapes', () => {
 const login=createMicrosoftLogin('public-client-id')
 const authorize=new URL(login.url)
 assert.equal(authorize.searchParams.get('state'),login.state)
 assert.equal(authorize.searchParams.get('redirect_uri'),REDIRECT_URI)
 assert.notEqual(createMicrosoftLogin('public-client-id').state,login.state)
 for(const code of ['M.R3+abc/def==','value%2Bnot-double-decoded','a&b=c#fragment','a b+c','á😀']){
  const callback=REDIRECT_URI+'?'+new URLSearchParams({code,state:login.state})
  assert.equal(parseMicrosoftRedirect(callback,login.state).code,code)
 }
 // Regression: the old decodeURI parser left these values percent-encoded.
 assert.notEqual(decodeURI(encodeURIComponent('M.R3+a/b==')),'M.R3+a/b==')
})
test('Only the exact callback with matching state can deliver a code', () => {
 const state='expected'
 for(const uri of ['https://login.microsoftonline.com.evil.example/common/oauth2/nativeclient?code=x&state=expected','http://login.microsoftonline.com/common/oauth2/nativeclient?code=x&state=expected','https://login.microsoftonline.com/common/oauth2/nativeclient/other?code=x&state=expected','not a URL']) assert.equal(parseMicrosoftRedirect(uri,state),null)
 for(const query of ['code=x','code=x&state=wrong','code=x&state=expected&state=expected']) assert.equal(parseMicrosoftRedirect(REDIRECT_URI+'?'+query,state).error,'invalid_state')
 assert.equal(parseMicrosoftRedirect(REDIRECT_URI+'?state=expected&code=a&code=b',state).error,'missing_code')
 const denied=parseMicrosoftRedirect(REDIRECT_URI+'?state=expected&error=access_denied&error_description=Login+cancelado',state)
 assert.equal(denied.error_description,'Login cancelado')
})
test('Overlapping Electron navigation events redeem a code only once', () => {
 const deliveries=[]
 const receive=createRedirectReceiver('expected',r=>deliveries.push(r))
 assert.equal(receive('https://login.live.com/'),false)
 const url=REDIRECT_URI+'?state=expected&code=a%2Bb%2F%3D'
 assert.equal(receive(url),true)
 assert.equal(receive(url),false)
 assert.deepEqual(deliveries,[{code:'a+b/='}])
})
test('Decoded callback code reaches the token endpoint unchanged', async t => {
 const {MicrosoftAuth}=require('helios-core/microsoft')
 const original=MicrosoftAuth.TOKEN_ENDPOINT
 const expected='M.R3+code/with=padding%2B'
 let received
 const server=http.createServer((req,res)=>{
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
   received=new URLSearchParams(body)
   res.writeHead(200,{'Content-Type':'application/json'})
   res.end(JSON.stringify({access_token:'test-only',refresh_token:'test-only',expires_in:3600}))
  })
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 MicrosoftAuth.TOKEN_ENDPOINT=`http://127.0.0.1:${server.address().port}/token`
 t.after(()=>{MicrosoftAuth.TOKEN_ENDPOINT=original;return new Promise(resolve=>server.close(resolve))})
 const callback=REDIRECT_URI+'?'+new URLSearchParams({code:expected,state:'test-state'})
 const response=await MicrosoftAuth.getAccessToken(parseMicrosoftRedirect(callback,'test-state').code,false,'test-client')
 assert.equal(response.responseStatus,0)
 assert.equal(received.get('code'),expected)
 assert.equal(received.get('client_id'),'test-client')
 assert.equal(received.get('redirect_uri'),REDIRECT_URI)
})
test('Displayable errors show stage and safe codes without tokens, cookies or raw descriptions', () => {
 const response={error:{response:{statusCode:400,body:{error:'invalid_grant',error_codes:[70000],error_description:'SECRET',access_token:'SECRET',refresh_token:'SECRET'},headers:{'set-cookie':'SECRET'}}}}
 const error=describeMicrosoftFailure(response,'Microsoft')
 assert.match(error.desc,/AADSTS70000/)
 assert.equal(JSON.stringify(error).includes('SECRET'),false)
 const next=describeMicrosoftFailure({error:{response:{statusCode:403}}},'autorização Minecraft')
 assert.match(next.desc,/Minecraft.*HTTP 403/)
})
