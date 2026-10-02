const { withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/** Android native errors must be scrubbed even before JavaScript exists. */
module.exports = config => {
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Private Sentry requires the reviewed Kotlin application');
    if (!mod.modResults.contents.includes('SavortomeSentry.init(this)')) {
      const anchor = 'super.onCreate()';
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Private Sentry application init anchor missing');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}\n    SavortomeSentry.init(this)`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', mod => {
    const packageName = mod.android.package;
    const directory = path.join(mod.modRequest.platformProjectRoot,'app/src/main/java',...packageName.split('.'));
    fs.mkdirSync(directory,{recursive:true});
    const template = fs.readFileSync(path.join(__dirname,'SavortomeSentry.kt.template'),'utf8');
    fs.writeFileSync(path.join(directory,'SavortomeSentry.kt'),template.replace('PACKAGE_NAME',packageName));
    return mod;
  }]);
};
