import path from 'path';
import fs from 'fs';

function fixJSMediaTagsError() {
  try {
    const packageJsonPath = path.resolve(
      __dirname,
      '../node_modules/jsmediatags/package.json'
    );
    const packageJsonString = fs.readFileSync(packageJsonPath, {
      encoding: 'utf8'
    });
    const packageJson = JSON.parse(packageJsonString);
    packageJson.browser = packageJson.browser.replace(
      'jsmediatags.js',
      'jsmediatags.min.js'
    );
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), {
      encoding: 'utf8'
    });
    console.log('开始执行了', packageJsonPath);
  } catch {}
}

export const FixJSMediaTagsErrorPlugin = function () {
  return {
    name: 'vite-plugin-fix-',
    apply: 'build',
    buildStart: fixJSMediaTagsError
  };
};
