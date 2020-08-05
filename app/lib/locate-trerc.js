const fs = require('fs')
const {parse, join} = require('path')

module.exports = function locate(path) {
  if (fs.existsSync(join(path, '.trerc'))) return path
  const {dir} = parse(path)
  if (!dir) throw new Error('Unable to locate .trerc')
  return locate(dir)
}
