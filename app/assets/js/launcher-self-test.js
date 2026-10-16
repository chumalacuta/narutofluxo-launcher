const fs = require('fs')
const os = require('os')
const path = require('path')

exports.install = function(app, BrowserWindow) {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-packaged-test-'))
    app.setPath('userData', output)
    process.env.FLUXO_SMOKE_TEST = '1'
    app.whenReady().then(async () => {
        let result
        try {
            const deadline = Date.now() + 45000
            while (Date.now() < deadline) {
                const win = BrowserWindow.getAllWindows()[0]
                try {
                    if (win && await win.webContents.executeJavaScript("typeof DistroAPI !== 'undefined' && document.getElementById('loginOptionMicrosoft') && ConfigManager.getSelectedServer()")) {
                        result = await win.webContents.executeJavaScript(`(async () => {
                            const d = await DistroAPI.getDistribution()
                            const a = await require('./assets/js/authmanager').addMojangAccount('FluxoTeste', '')
                            return {server:d.getMainServer().rawServer.address, modules:d.getMainServer().modules.length, offline:a.type === 'offline', microsoft:!document.getElementById('loginOptionMicrosoft').disabled}
                        })()`)
                        if (result.server !== '181.214.48.21:10101' || result.modules !== 115 || !result.offline || !result.microsoft) throw new Error('Packaged application validation failed')
                        fs.writeFileSync(path.join(output,'launcher.png'), (await win.webContents.capturePage()).toPNG())
                        break
                    }
                } catch (error) { result = {error:error.message} }
                await new Promise(resolve => setTimeout(resolve, 100))
            }
            if (!result || result.error) throw new Error(result?.error || 'Application did not initialize')
            fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
            console.log('FLUXO_PACKAGED_OK ' + output)
            app.exit(0)
        } catch (error) {
            fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({error:error.message}))
            console.error('FLUXO_PACKAGED_FAILED ' + output)
            app.exit(1)
        }
    })
}
