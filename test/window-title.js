//jshint esversion: 9
//jshint -W079
const fs = require('fs')
const {join} = require('path')
const crypto = require('crypto')
const test = require('tape')
const spawn_bop = require('./lib/spawn-bop-with-puppeteer')
const wait = require('./lib/wait')
const mkdirp = require('mkdirp').sync

test('window title', t=>{
  const dir = `/tmp/${Date.now()}`
  let browser
  mkdirp(dir)
  const configPath = join(dir, 'config')
  console.log('configPath', configPath)
  const appkey = crypto.randomBytes(32).toString('base64')
  fs.writeFileSync(configPath, JSON.stringify({
    network: `*${appkey}.random`,
    launchLocal: `${__dirname}/fixtures/window-title/index.js`,
  }), 'utf8')

  const bop = spawn_bop([
    `${__dirname}/fixtures/window-title/index.js`,
    `--config=${configPath}`
  ], {
    env: Object.assign({}, process.env, {
      DEBUG: 'bop:sbot,bop:appperms,bop:browser-console',
      DEBUG_LOG: 1,
      DEBUG_COLORS: 1
    })
  }, (err, _browser) =>{
    browser = _browser
    t.error(err, 'puppeteer connected')
    ;(async function() {
      const appTarget = await browser.waitForTarget(t=>t.url().includes('index.js'))
      t.ok(appTarget, 'app tab found')
    })()
  })


  async function clickClose(n) {
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    t.ok(tabbarTarget, 'tabbar found')
    const tabbar = await tabbarTarget.page()
    const closeButtons = await tabbar.$$('.tab .close', {visible: true})
    console.log(`Clicking close button ${n}`)
    await closeButtons[n].click()
  }

  async function clickAdd() {
    console.log('Adding another tab')
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    const tabbar = await tabbarTarget.page()
    const button = await tabbar.waitForSelector('.button.add-tab', {visible: true})
    console.log('Clicking Add Tab')
    await button.click()
  }

  async function closeAll() {
    await clickClose(1)
    await clickClose(1)
    await clickClose(0)
  }

  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })
  let count = 0
  bop.stderr.on('data', data =>{
    process.stdout.write(data)
    if (data.includes(`app key: ${appkey}`)) {
      t.pass('tab logged corret app key')
      if (++count < 3) {
        clickAdd()
      } else {
        closeAll()
      }
    }
  })

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    t.end()
  })

})
