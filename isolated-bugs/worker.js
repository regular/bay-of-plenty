const {Worker} = require('worker_threads')
const {app} = require('electron')

const worker_code = `
  process.exit(0)
`

app.on('ready', ()=>{
  const worker = new Worker(worker_code, {
    eval: true
  })

  worker.on('exit', code=>{
    console.log('exited with code', code)
  })

  setTimeout( ()=>{
    app.quit()
  }, 1000)
})

