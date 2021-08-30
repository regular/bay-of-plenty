//jshint esversion: 9
//jshint -W079
const fs = require('fs')
const {join} = require('path')
const crypto = require('crypto')
const test = require('tape')
const mkdirp = require('mkdirp').sync
const ssbKeys = require('ssb-keys')
const client = require('ssb-zero-conf-client')
const inviteCodes = require('tre-invite-code')

const spawn_bop = require('./lib/spawn-bop-with-puppeteer')
const Pub = require('./lib/pub')
const wait = require('./lib/wait')
const uploadApp = require('./lib/upload-app')
const rc = require('rc')

const QUIET = 0
const DEBUG = 'tre-boot,bop:open-app,bop:browser-console,multiserver:net ssb-zero-conf-client,bop:shared-pool'
const dir = `/tmp/${Date.now()}`
const configPath = join(dir, 'config')
const appkey = crypto.randomBytes(32).toString('base64')
const keypair = ssbKeys.generate()
const port = 60999
let bop, browser, browserUtil, pub, appMessage, longInvite, invalidInvite

test('make sure we control the config', t=>{
  const config = rc('tre')
  if ( (config.configs || []).length !== 0) {
    console.error('foreign files mixed into config:', config.configs)
    process.exit(1)
  }
  t.end() 
})

test('start a pub', t => {
  const path = `${dir}-pub`
  console.log(`pub path is: ${path}`)
  mkdirp(path)
  const shs = appkey
  const config = {
    allowPrivate: true,
    path,
    port: port + 2,
    caps: {shs}
  }
  Pub(config, (err, ssb) =>{
    t.error(err)
    t.ok(ssb, 'pub api')
    pub = ssb
    console.log(`pub id: ${pub.id}`)
    t.end()
  })
})

test('upload app', t=>{
  uploadApp(pub, join(__dirname, 'fixtures/hello_world.html'), (err, content) =>{
    t.error(err)
    t.ok(content, 'has created message content')
    pub.publish(content, (err, kv) =>{
      t.error(err)
      t.ok(kv)
      console.dir(kv)
      appMessage = kv
      t.end()
    })
  }) 
})

test('make invite code', t=>{
  t.ok(pub.invite.create, 'pub can create invites')
  pub.invite.create(1, (err, invite) =>{
    t.error(err, 'invite.create succeeded')
    t.ok(invite, 'created invite code')
    console.log(`invite code: ${invite}`)
    longInvite = inviteCodes.stringify({
      network: `*${appkey}.random`,
      autoinvite: invite,
      autoname: 'alice',
      autofollow: pub.id,
      boot: appMessage.key
    })
    t.ok(longInvite)
    console.log(`long invite: ${longInvite}`)

    invalidInvite = inviteCodes.stringify({
      network: `*${appkey}.random`,
      autoinvite: invite.replace(/~./,'~xx'),
      autoname: 'alice',
      autofollow: pub.id,
      boot: appMessage.key
    })
    t.end()
  })
})

test('launch bootmenu', t=>{
  mkdirp(dir)
  console.log('configPath', configPath)
  fs.writeFileSync(configPath, JSON.stringify({
    network: `*${appkey}.random`,
    port
  }), 'utf8')

  bop = spawn_bop([
    `${__dirname}/../bop-bootmenu/index.js`,
    `--config=${configPath}`,
    `--authorize=${keypair.id}`,
    '--fail-on-error',
    '--clean-session',
    '--launch-local-in-all-tabs'
  ], {
    env: Object.assign({}, process.env, {
      DEBUG,
      DEBUG_COLORS: 1,
      DEBUG_LOG: 1
    })
  }, (err, _browser) =>{
    browser = _browser
    browserUtil = require('./lib/browser-util')(browser)
    t.error(err, 'puppeteer connected')
    ;(async function() {
      const appTarget = await browser.waitForTarget(t=>t.url().includes('index.js'))
      t.ok(appTarget, 'app tab found')
      t.end()
    })()
  })

  // if bop exits with a fatal error, this
  // test fails
  bop.on('exit', code =>{
    if (code) process.exit(code)
  })

  bop.stdout.on('data', data =>{
    if (!QUIET) {
      process.stdout.write(data)
    }
  })

  bop.stderr.on('data', data =>{
    if (!QUIET) {
      process.stdout.write(data)
    }
  })
})

/*
test('connect to sbot', t=>{
  client(appkey, keypair, (err, ssb) =>{
    t.error(err)
    t.ok(client)
    t.end()
  })
})
*/

async function fillInvite(menu, longInvite) {
  const form = await menu.waitForSelector('form[action="/add-network"]', {visible: false})
  console.log('found form, open details')
  await form.evaluate(form=>{
    const details = form.parentElement.parentElement
    console.log('details', details)
    details.open = true
  })
  console.log('details open')
  const textarea = await menu.waitForSelector('form[action="/add-network"] textarea[name=code]', {visible: true})
  await textarea.type(longInvite)
}

test('use invalid invite code', t=>{

  ;(async function() {
    await wait(2000)

    const menuTarget = await browserUtil.waitForNewTarget('index.js')
    const menuPage = await menuTarget.page()

    await fillInvite(menuPage, invalidInvite)

    const button = await menuPage.waitForSelector('form[action="/add-network"] button', {visible: true})
    await button.click()
    await wait(1000)

    const modalTextEl = await menuPage.waitForSelector('.tre-modal-dialog-dimmer .text', {visible: true})
    const modalText = await modalTextEl.evaluate(el=>el.innerText)
    t.ok(/failed to parse/.test(modalText), 'error message is displayed')

    await wait(2000)
    t.end()
  })()
})


test('fill in invite code', t=>{

  ;(async function() {
    await wait(2000)

    await browserUtil.addTab()

    const menuTarget = await browserUtil.waitForNewTarget('index.js')
    const menuPage = await menuTarget.page()
    const button = await menuPage.waitForSelector('form[action="/add-network"] button', {visible: true})
    t.ok(await button.evaluate(el=>el.disabled), 'button is disabled')

    await fillInvite(menuPage, longInvite)

    t.notOk(await button.evaluate(el=>el.disabled), 'button is enabled')
    await button.click()
    
    const helloWorldTarget = await browser.waitForTarget(t=>t.url().includes('blobs/get/'+ encodeURIComponent(appMessage.value.content.codeBlob) ))
    t.ok(helloWorldTarget, 'hello world app opened')
    t.end()
  })()
})

test('try to re-use invite code', t=>{

  ;(async function() {
    await wait(2000)
    await browserUtil.addTab()

    const menuTarget = await browserUtil.waitForNewTarget('index.js')
    const menuPage = await menuTarget.page()

    await fillInvite(menuPage, longInvite)

    const button = await menuPage.waitForSelector('form[action="/add-network"] button', {visible: true})
    await button.click()
    await wait(2000)

    const modalTextEl = await menuPage.waitForSelector('.tre-modal-dialog-dimmer .text', {visible: true})
    const modalText = await modalTextEl.evaluate(el=>el.innerText)
    t.ok(/not accepted/.test(modalText), 'error message is displayed')
    
    t.end()
  })()
})

test('close bootmaneu tab', t=>{

  async function clickClose() {
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    t.ok(tabbarTarget, 'tabbar found')
    const tabbar = await tabbarTarget.page()
    const close = await tabbar.waitForSelector('.tab.active .close', {visible: true})
    console.log('found close button')
    console.log('Clicking close')
    await close.click()
  }

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    pub.close()
    t.end()
  })

  ;(async function() {
    try {
      await wait(1000)
      await clickClose()
      await wait(1000)
      await clickClose()
      await wait(1000)
      await clickClose()
    } catch(e) {
      t.fail(e.message)
      bop.kill() // this will trigger the handler above and t.end() the test
    }
  })()
})

