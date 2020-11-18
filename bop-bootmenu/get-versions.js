
module.exports = function getVersions(ssb, config, cb) {
  const sep = ' • '
  const copyright = 'Copyright 2020 Jan Bölsche'
  let result = []

  function postProc(result) {
    if (result.length && result[0].startsWith('Bay')) {
      result = [result[0]].concat([copyright]).concat(result.slice(1))
    } else {
      result.unshift(copyright)
    }
    return result.join(sep)
  }

  if (config && config.bootMsgRevision) {
    result.push(`BOP Bootmenu ${shorter(config.bootMsgRevision || 'n/a')}`)
  }
  if (!ssb.bayofplenty) return cb(null, postProc(result))
  ssb.bayofplenty.versions((err, versions)=>{
    if (err) return cb(err)
    const {node, modules, electron, chrome} = versions
    result = result.concat([
      `Node: ${node} (ABI ${modules})`,
      `Electron ${electron}`,
      `Chrome ${chrome}`
    ])
    result.unshift(
      `Bay of Plenty ${versions['bay-of-plenty']}`
    )
    cb(null, postProc(result))
  })
}

function shorter(s) {
  return s.substr(0, 6)
}

