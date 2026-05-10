const { execFileSync } = require('child_process');
const path = require('path');

const appDirs = [
  'apps/angular-realworld-example-app',
  'apps/realworld',
  'apps/vue3-realworld-example-app',
];

for (const relativeDir of appDirs) {
  const cwd = path.join(process.cwd(), relativeDir);
  console.log(`Installing app dependencies in ${relativeDir}...`);
  execFileSync('npm', ['ci'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
