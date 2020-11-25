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

const AvatarUpdate = require('./avatar-updates')

const bricons = require('bricons')
const svgSymbol = require('./svg-symbol')
const avatarPlaceholder = svgSymbol(
  bricons.svg('ionicons/person')
)
const addSymbol = svgSymbol(
  bricons.svg('ionicons/add')
)

const SIZE = 128

module.exports = function(ssb) {
  const getAvatarUpdates = AvatarUpdate(ssb)
  return function renderIdsOfNetwork(netkey) {
    const pubKeys = getIdentities(netkey)
    const selected = Value(localStorage[`id-${netkey}`])
    if (!selected()) selected.set(pubKeys.get(0))
    selected(v => localStorage[`id-${netkey}`] = v)

    function manageScroll(ul) {
      const animate = Animator(x=>ul.scrollLeft = x)
      const abortWatch = selected(v=>{
        scrollTo(v, 250)
      })
      // selection is set before lis exist
      setTimeout( ()=>{
        scrollTo(selected(), 0)
      }, 100)

      function scrollTo(v, duration) {
        if (!v) return
        v = safeId(v)
        const ulbr = ul.getBoundingClientRect()
        const li = ul.querySelector(`[data-id="${v}"]`)
        if (!li) return
        const libr = li.getBoundingClientRect()
        const xoffset = libr.left - (ulbr.left - ul.scrollLeft)
        const liHalfWidth = libr.width / 2
        const ulHalfWidth = ulbr.width / 2
        const targetValue = xoffset + liHalfWidth - ulHalfWidth
        animate(ul.scrollLeft, targetValue, duration)
      }
      return ()=>{
        abortWatch()
        animate.cancel()
      }
    }

    return h('.identities-container', [
      h('.identities', [
        h('ul', {
          hooks: [manageScroll]
        }, [
          MutantMap(pubKeys, renderIdentity),
          renderAddIdButton()
        ])
      ]),
      h('.selected-id', selected)
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
      return h('li.add', {
        'ev-click': ()=>{
          ssb.bayofplenty.addIdentity(netkey, (err, newId) =>{
            if (err) return console.error(err)
            pubKeys.push(newId)
            selected.set(newId)
          })
        }
      }, [
          h('.avatar', {
            style: {
              width: `${SIZE}px`,
              height: `${SIZE}px`
            }
          }, addSymbol()),
          h('label', [
            h('.caption', 'Add Identity')
          ])
        ]
      )
    }
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
  .identities-container {
    margin-top: 2em;
    width: 100%;
    -webkit-mask-image: linear-gradient(to right, transparent,black 20%, black 80%, transparent);
    //border-bottom: 1px solid #aaa;
  }
  .identities-container > .selected-id {
    display: grid;
    justify-content: center;
    margin-bottom: .6em;
    user-select: all;
    font-family: monospace;
    opacity: 0.7;
    //color: #111;
    //background: #777;
    padding: 4px;
  }
  .identities {
    width: 100%;
    display: grid;
    place-content: center;
  }
  .identities > ul {
    font-size: ${SIZE/4}px;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: ${SIZE*2}px;
    overflow-x: auto;
    padding-left: 0;
    margin-bottom: 0;
  }
  .identities > ul > li {
    cursor: pointer;
    display: grid;
    grid-template-rows: ${SIZE}px 2.5em;
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
    -webkit-box-reflect: below 5px linear-gradient(to bottom, transparent, transparent 50%, rgba(0,0,0,0.25));
  }
  .identities > ul > li.add > .avatar {
    background: transparent;
    border: none;
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
  .identities > ul > li > label div {
    white-space: break-spaces;
    text-align: center;
  }
  .identities > ul > li > label .caption {
    font-style: italic;
  }
  .identities > ul > li.selected,
  .identities > ul > li:hover {
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
    duration = dur
  }

  function animate() {
    const t = Date.now()
    const dt = Math.min(t - t0, duration)
    const x = duration ? x0 + (dt / duration) * (x1 - x0) : x1
    setter(x)
    if (dt == duration) return
    rafHandle = raf(animate)
  }

  function cancel() {
    raf.cancel(rafHandle)
  }
}
