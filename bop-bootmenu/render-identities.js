const styles = require('module-styles')('bop-bootmenu:render-identities')
const h = require('mutant/html-element')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const debug = require('debug')('bop-bootmenu:render-idenetities')
const pull = require('pull-stream')
const {isFeedId} = require('ssb-ref')
const raf = require('raf')

const bricons = require('bricons')
const svgSymbol = require('./svg-symbol')
const avatarPlaceholder = svgSymbol(
  bricons.svg('ionicons/person')
)

const SIZE = 128

module.exports = function(ssb) {
  return function renderIdsOfNetwork(netkey) {
    const pubKeys = getIdentities(netkey)
    const selected = Value(localStorage[`id-${netkey}`])
    if (!selected()) selected.set(pubKeys.get(0))
    selected(v => localStorage[`id-${netkey}`] = v)

    function manageScroll(ul) {
      const animate = Animator(x=>ul.scrollLeft = x)
      const abortWatch = selected(v=>{
        v = safeId(v)
        const ulbr = ul.getBoundingClientRect()
        const li = ul.querySelector(`[data-id="${v}"]`)
        if (!li) return
        const libr = li.getBoundingClientRect()
        const xoffset = libr.left - (ulbr.left - ul.scrollLeft)
        const liHalfWidth = libr.width / 2
        const ulHalfWidth = ulbr.width / 2
        const targetValue = xoffset + liHalfWidth - ulHalfWidth
        animate(ul.scrollLeft, targetValue, 250)
      })
      selected.set(selected())
      return ()=>{
        abortWatch()
        animate.cancel()
      }
    }

    return h('.ieentities-container', [
      h('.identities', [
        h('ul', {
          hooks: [manageScroll]
        }, MutantMap(pubKeys, renderIdentity)),
      ]),
      renderAddIdButton()
    ])

    function renderIdentity(id) {
      const avatar = getAvatarUpdates(netkey, id)
      return computed([avatar, selected], (avatar, sel) => {
        const isSelected = sel == id
        const thumbnailUrl = avatar && avatar.image && avatar.image[`${SIZE}x${SIZE}`]
        const name = avatar && avatar.name 
        return h('li', {
          'data-id': safeId(id),
          classList: isSelected ? ['selected'] : [],
          'ev-click': e => selected.set(id)
        }, [
          h('.avatar', {
            style: {
              width: `${SIZE}px`,
              height: `${SIZE}px`
            }
          }, [
            thumbnailUrl ?
            h('div', {
              style: {
                'background-image': `url(${thumbnailUrl})`
              }
            }) : avatarPlaceholder()
          ]),
          h('label', [
            h('.name', name || '[no name assigned]'),
          ])
        ])
      })
    }

    function renderAddIdButton() {
      if (!(ssb.bayofplenty && ssb.bayofplenty.addIdentity)) return []
      return h('button.addIdentity',{
        'ev-click': ()=>{
          ssb.bayofplenty.addIdentity(netkey, (err, newId) =>{
            if (err) return console.error(err)
            pubKeys.push(newId)
            selected.set(newId)
          })
        }
      }, 'Add Identity')
    }
  }

  function getAvatarUpdates(netkey, id) {
    const avatar = Value()
    if (ssb.bayofplenty && ssb.bayofplenty.avatarUpdates) {
      pull(
        ssb.bayofplenty.avatarUpdates(netkey, id),
        pull.drain(newAvatar =>{
          debug('new avatar %o', newAvatar)
          avatar.set(newAvatar)
        }, err => {
          console.error(`avatarUpdates failed: ${err.message}`)
        })
      )
    }
    return avatar
  }

  function getIdentities(netkey) {
    const pubKeys = MutantArray()
    if (!(ssb.bayofplenty && ssb.bayofplenty.listPublicKeys)) {
      pubKeys.set(['default ID', 'additional ID'])
      return pubKeys
    } 
    pull(
      ssb.bayofplenty.listPublicKeys(netkey),
      pull.collect( (err, results) => {
        if (err) return console.error(err.message)
        pubKeys.set(results)
      })
    )
    return pubKeys
  }

}

function safeId(v) {
  if (!isFeedId(v)) throw new Error(`bad id: ${v}`)
  return Buffer.from(v.split('.')[0], 'base64').toString('hex')
}

styles(`
  .identities {
    width: 100%;
  }
  .identities > ul {
    margin-top: 2em;
    font-size: ${SIZE/4}px;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: ${SIZE*2}px;
    overflow-x: auto;
  }
  .identities > ul > li {
    cursor: pointer;
    display: grid;
    grid-template-rows: ${SIZE}px 2em;
    row-gap: 1em;
    opacity: .5;
  }
  .identities > ul > li > .avatar {
    background: #555;
    fill: #333;
    border-radius: 50%;
    border: 5px solid #222;
    justify-self: center;
    overflow: hidden;
  }
  .identities > ul > li.selected > .avatar {
    border: 5px solid #aaa;
  }
  .identities > ul > li > .avatar > * {
    height: 100%;
    width: 100%;
    background-size: cover;
  }
  .identities > ul > li > label {
    overflow: hidden;
  }
  .identities > ul > li > label .name {
    white-space: break-spaces;
    text-align: center;
  }
  .identities > ul > li.selected {
    opacity: 1;
  }
  button.addIdentity {
    font-size: .6em;
  }
`)

function Animator(setter) {
  let rafHandle
  let x0, x1, t0, duration
  startAnimation.cancel = cancel
  return startAnimation
  
  function startAnimation(curr, target, dur) {
    cancel()
    rafHandle = raf(animate)
    t0 = Date.now()
    x0 = curr
    x1 = target
    duration = dur || 2000
  }

  function animate() {
    const t = Date.now()
    const dt = Math.min(t - t0, duration)
    const x = x0 + (dt / duration) * (x1 - x0)
    setter(x)
    if (dt == duration) return
    rafHandle = raf(animate)
  }

  function cancel() {
    raf.cancel(rafHandle)
  }
}
