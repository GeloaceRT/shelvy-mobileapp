const { remote } = require('webdriverio');
const fs = require('fs');

(async () => {
  // Use Appium v3 default path and W3C namespaced capabilities for Appium v3+
  const opts = {
    path: '/',
    port: 4723,
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.ANDROID_DEVICE || 'Android Device',
      // If you installed your Expo dev-client APK, set either `app` to the path
      // or set `appPackage` and `appActivity` to the installed package/activity.
      // Example defaults (update if you built a custom dev-client):
      'appium:appPackage': process.env.APP_PACKAGE || 'host.exp.exponent',
      'appium:appActivity': process.env.APP_ACTIVITY || '.MainActivity',
      'appium:newCommandTimeout': 240
    }
  };

  if (!fs.existsSync('artifacts')) fs.mkdirSync('artifacts');

  const driver = await remote(opts);
  try {
    // small wait to let the app start
    await driver.pause(4000);

    // Attempt to find likely error indicators. Update selectors for your app.
    const trySelectors = [
      '~error-toast',
      "//android.widget.TextView[contains(@text,'error') or contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'error')]",
      "//*[@content-desc='Alert' or contains(@content-desc,'error')]"];

    let found = null;
    for (const sel of trySelectors) {
      try {
        const el = await driver.$(sel);
        if (await el.isDisplayed()) { found = sel; break; }
      } catch (e) { /* ignore */ }
    }

    const out = `artifacts/${found ? 'error' : 'screen'}-${Date.now()}.png`;
    await driver.saveScreenshot(out);
    console.log('Saved screenshot:', out);
  } catch (e) {
    const out = `artifacts/failure-${Date.now()}.png`;
    try { await driver.saveScreenshot(out); console.error('Saved failure screenshot:', out); } catch (s) { console.error('Failed saving screenshot', s); }
    console.error(e);
    process.exitCode = 1;
  } finally {
    await driver.deleteSession();
  }
})();
