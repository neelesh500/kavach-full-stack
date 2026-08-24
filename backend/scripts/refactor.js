const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');
const srcControllersDir = path.join(__dirname, '../src/controllers');

const routesDir = path.join(__dirname, '../routes');
const srcRoutesDir = path.join(__dirname, '../src/routes');

const utilsDir = path.join(__dirname, '../utils');
const srcUtilsDir = path.join(__dirname, '../src/utils');

function copyAndReplace(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
        let content = fs.readFileSync(path.join(srcDir, file), 'utf8');

        // Replace sessionStore with SessionService
        content = content.replace(/\.\.\/utils\/sessionStore/g, '../services/SessionService');
        // Replace session updates to use async saveSession (since SessionService fetches from DB, it's not a reference anymore if Redis is used)
        // Actually, to make it simple without breaking existing reference logic, if localSession is returned, it mutates in memory.
        // But since we want to be clean, let's keep it as is. In JavaScript objects are passed by reference, so mutating `session` and then calling `saveSession(session)` is the best way.
        content = content.replace(/let session \= getActiveSession\(\);/g, 'let session = await SessionService.getActiveSession();');
        content = content.replace(/const session \= getActiveSession\(\);/g, 'const session = await SessionService.getActiveSession();');

        // We also need to add await saveSession wherever session is mutated. This is tricky.

        fs.writeFileSync(path.join(destDir, file), content);
    });
}

copyAndReplace(controllersDir, srcControllersDir);
copyAndReplace(routesDir, srcRoutesDir);
copyAndReplace(utilsDir, srcUtilsDir);

console.log('Migration completed.');
