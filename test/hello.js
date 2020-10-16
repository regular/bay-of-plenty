//jshint esversion: 9
//jshint -W079
const test = require('tape')
const spawn_bop = require('./lib/spawn-bop-with-puppeteer')

test('hello world!', t=>{
  const bop = spawn_bop([`${__dirname}/fixtures/hello_world.js`], {
    env: Object.assign({}, process.env, {
      DEBUG: 'bop:script-loader',
      DEBUG_COLORS: 1
    })
  }, (err, browser) =>{
    t.error(err)
    
    let numPages = 0
    browser.on('targetcreated', target=>{
      console.log('new', target.type(), target.url())
    })
    browser.on('targetchanged', async target => {
      console.log('changed', target.type(), target.url())
      if (target.type() == 'page') numPages++
      if (numPages < 3) return

      let tabbar, hello
      const pages = await browser.pages()
      const titles = await Promise.all(pages.map(p=>p.title()))
      titles.forEach( (t, i) =>{
        console.log(`- ${t}`)
        if (t.startsWith('Bay of Plenty')) {
          tabbar = pages[i]
        } else {
          hello = pages[i]
        }
      })
      if (!tabbar) return t.fail('no tabbar')
      if (!hello) return t.fail('no hello world tab')

      const close = await tabbar.waitForSelector('.tab.active .close')
      console.log('Clicking close')
      await close.click()
    })
  })

  /*
  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })
  bop.stderr.on('data', data =>{
    process.stdout.write(data)
  })
  */

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    t.end()
  })

})
