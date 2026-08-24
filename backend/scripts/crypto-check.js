const crypto = require('crypto');
const secrets = require('secrets.js-grempe');
const { encryptShareWithPassword, decryptShareWithPassword } = require('../utils/cryptoUtils');

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const masterKey = crypto.randomBytes(32).toString('hex');
const passwords = ['pw1', 'pw2', 'pw3', 'pw4', 'pw5'];

const shares = secrets.share(masterKey, 5, 3);
const encrypted = shares.map((s, i) => encryptShareWithPassword(s, passwords[i]));

check('Split into 5 shares', shares.length === 5);
check('Shares are unique', new Set(shares).size === 5);

const decrypted = encrypted.map((e, i) => decryptShareWithPassword(e, passwords[i]));
check('All shares decrypt with correct password', decrypted.every((d, i) => d === shares[i]));

let wrong = false;
try {
  decryptShareWithPassword(encrypted[0], 'wrongpw');
} catch (e) {
  wrong = true;
}
check('Wrong password fails to decrypt (GCM auth tag)', wrong);

const sub = [shares[0], shares[1], shares[2]];
const recovered = secrets.combine(sub);
check('3 shares recover the exact master key', recovered === masterKey);

let failedTwo = true;
try {
  secrets.combine([shares[0], shares[1]]);
} catch (e) {
  failedTwo = true;
}
check('2 shares do NOT produce a valid key', failedTwo === true, 'combine errors or garbage');

const recoveredAll = secrets.combine(shares);
check('5 shares also recover the key', recoveredAll === masterKey);

console.log(`\nmasterKey: ${masterKey}`);
