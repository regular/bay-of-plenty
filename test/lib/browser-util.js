// jshint esversion: 8

module.exports = function(browser) {
  const knownTargets = []

  return {
    addTab,
    waitForNewTarget
  }

  async function waitForNewTarget(url) {
    const target = await browser.waitForTarget(t=>t.url().includes(url) && !knownTargets.includes(t.targetID) )
    console.log(`new known target: ${target.targetID}`)
    knownTargets.push(target.targetID)
    return target
  }

  async function addTab() {
    console.log('Adding another tab')
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    const tabbar = await tabbarTarget.page()
    const button = await tabbar.waitForSelector('.button.add-tab', {visible: true})
    console.log('Clicking Add Tab')
    await button.click()
  }

}
