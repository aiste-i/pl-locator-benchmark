const { execSync } = require('child_process');

execSync('npm run reports:generate', { stdio: 'inherit' });

execSync('git diff --exit-code -- reports', { stdio: 'inherit' });
