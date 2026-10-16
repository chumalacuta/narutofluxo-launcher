from pathlib import Path
import hashlib,json,zipfile,io,urllib.request,concurrent.futures,re,os
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(os.environ.get('FLUXO_CLIENT_DIR',Path.home()/'AppData/Roaming/.technic/modpacks/narutofluxo'))
OUT=ROOT/'bundle';OBJECTS=OUT/'objects';OBJECTS.mkdir(parents=True,exist_ok=True)
settings=json.loads((ROOT/'fluxo-settings.json').read_text());records=[];defaults=[];common_defaults=[]
def artifact(data):
 h=hashlib.sha256(data).hexdigest();p=OBJECTS/h
 if not p.exists():p.write_bytes(data)
 return {'size':len(data),'MD5':hashlib.md5(data).hexdigest(),'SHA256':h,'url':'bundle:'+h}
def module(mid,name,kind,data,path=None):
 a=artifact(data)
 if path:a['path']=path
 return {'id':mid,'name':name,'type':kind,'artifact':a}
def add_file(path,data):
 m=module('fluxo.file:'+path,path,'File',data,path);records.append(m)
# Client JARs are the current tested Technic files, including newer user changes.
for p in sorted((SRC/'mods').rglob('*.jar')):add_file(p.relative_to(SRC).as_posix(),p.read_bytes())
for folder in ['resources','customnpcs/assets']:
 for p in sorted((SRC/folder).rglob('*')):
  if p.is_file() and p.suffix.lower() in ['.png','.jpg','.jpeg','.json','.obj','.mtl','.ogg','.lang','.txt','.mcmeta']:
   add_file(p.relative_to(SRC).as_posix(),p.read_bytes())
# Only active packs. Zip loose packs without changing the Technic installation.
selected=json.loads(next(l.split(':',1)[1] for l in (SRC/'options.txt').read_text().splitlines() if l.startswith('resourcePacks:')))
selected_new=[]
for name in selected:
 p=SRC/'resourcepacks'/name
 if not p.exists():raise RuntimeError('Selected resource pack missing: '+name)
 if p.is_dir():
  buf=io.BytesIO()
  with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for f in sorted(p.rglob('*')):
    if f.is_file():z.writestr(zipfile.ZipInfo(f.relative_to(p).as_posix(), date_time=(1980,1,1,0,0,0)),f.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
  name+='.zip';data=buf.getvalue()
 else:data=p.read_bytes()
 add_file('resourcepacks/'+name,data);selected_new.append(name)
# Client configuration is seeded only once; player choices are not rewritten each launch.
server_only={'nfroleta.json','NarutoFluxo-catalogo.json','NarutoFluxo-doujutsus.cfg','NarutoFluxo-modos.cfg'}
for p in sorted((SRC/'config').rglob('*')):
 if not p.is_file() or p.name in server_only or p.suffix.lower() not in ['.cfg','.json','.properties','.toml','.txt']:continue
 if re.search(r'auth|token|session|password|secret|account|playerdata|tracked',p.as_posix(),re.I):continue
 rel=p.relative_to(SRC).as_posix();defaults.append({'path':rel,**artifact(p.read_bytes())})
defaults.append({'path':'options.txt',**artifact(('resourcePacks:'+json.dumps(selected_new,separators=(',',':'))+'\n').encode())})
# Et Futurum's AssetDirector downloads otherwise block the client thread on first boot.
cache=Path.home()/'AppData/Roaming/.technic/assets/asset_director'
for p in sorted(cache.rglob('*')):
 if not p.is_file():continue
 if p.parent.name!='indexes' and re.fullmatch('[a-f0-9]{40}',p.name):
  if hashlib.sha1(p.read_bytes()).hexdigest()!=p.name:raise RuntimeError('Corrupt AssetDirector resource: '+p.name)
 elif p.suffix!='.json':continue
 common_defaults.append({'path':'assets/asset_director/'+p.relative_to(cache).as_posix(),**artifact(p.read_bytes())})
(OUT/'common-defaults.json').write_text(json.dumps(common_defaults,indent=2)+'\n')
# Forge libraries are verified and bundled too. Vanilla Minecraft still comes from Mojang.
forge=(SRC/'bin/modpack.jar').read_bytes()
with zipfile.ZipFile(io.BytesIO(forge)) as z:version=json.loads(z.read('version.json'))
forge_module=module('net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10:universal','Minecraft Forge 10.13.4.1614','ForgeHosted',forge)
libs=[x for x in version['libraries'] if not x['name'].startswith('net.minecraftforge:forge:')]
def fetchlib(lib):
 group,name,ver=lib['name'].split(':');rel=group.replace('.','/')+'/'+name+'/'+ver+'/'+name+'-'+ver+'.jar'
 caches=[Path.home()/'AppData/Roaming/.helioslauncher/common/libraries'/rel,Path.home()/'AppData/Roaming/.minecraft/libraries'/rel]
 data=None
 for p in caches:
  if p.exists():
   candidate=p.read_bytes()
   if zipfile.is_zipfile(io.BytesIO(candidate)) and (not lib.get('checksums') or hashlib.sha1(candidate).hexdigest() in lib['checksums']):data=candidate;break
 if data is None:
  errors=[]
  for origin in ['https://libraries.minecraft.net/','https://maven.minecraftforge.net/','https://repo.maven.apache.org/maven2/']:
   try:
    req=urllib.request.Request(origin+rel,headers={'User-Agent':'NarutoFluxo-Launcher/2.2.2'})
    with urllib.request.urlopen(req,timeout=30) as r:data=r.read()
    if not zipfile.is_zipfile(io.BytesIO(data)):raise ValueError('Not a jar')
    if lib.get('checksums') and hashlib.sha1(data).hexdigest() not in lib['checksums']:
     # Old Forge manifests also list checksums of transformed/packed artifacts.
     # Accept the normal jar only when the authoritative Maven SHA1 verifies it.
     with urllib.request.urlopen(origin+rel+'.sha1',timeout=20) as digest_response:published=digest_response.read().decode().strip().split()[0]
     if hashlib.sha1(data).hexdigest()!=published:raise ValueError('Authoritative Maven SHA1 mismatch')
    break
   except Exception as e:errors.append(str(e));data=None
  if data is None:raise RuntimeError(lib['name']+': '+str(errors))
 return module(lib['name'],name,'Library',data)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:forge_module['subModules']=list(pool.map(fetchlib,libs))
distro={'version':'2026.10.16','servers':[{'id':settings['serverId'],'name':'NarutoFluxo','description':'Servidor oficial NarutoFluxo • Minecraft 1.7.10','icon':None,'version':'2026.10.16','address':settings['serverAddress'],'minecraftVersion':'1.7.10','mainServer':True,'autoconnect':True,'javaOptions':{'supported':'8.x','suggestedMajor':8},'modules':[forge_module]+records}]}
(OUT/'distribution.json').write_text(json.dumps(distro,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'defaults.json').write_text(json.dumps(defaults,indent=2)+'\n')
# Remove only generated, unreferenced content-addressed build objects.
referenced=set()
def collect(v):
 if isinstance(v,dict):
  if v.get('SHA256'):referenced.add(v['SHA256'])
  for x in v.values():collect(x)
 elif isinstance(v,list):
  for x in v:collect(x)
collect(distro);collect(defaults);collect(common_defaults)
for p in OBJECTS.iterdir():
 if p.is_file() and re.fullmatch('[a-f0-9]{64}',p.name) and p.name not in referenced:p.unlink()
summary={'mods':sum(m['artifact'].get('path','').startswith('mods/') for m in records),'managedFiles':len(records),'defaultConfigs':len(defaults),'commonResources':len(common_defaults),'objects':len(list(OBJECTS.iterdir())),'megabytes':round(sum(p.stat().st_size for p in OBJECTS.iterdir())/1048576,2),'selectedResourcePacks':selected_new,'excluded':['inactive resource packs','saves','screenshots','accounts and tokens','logs','CNPC clones and tracked usages','server-only configs']}
(OUT/'inventory.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
