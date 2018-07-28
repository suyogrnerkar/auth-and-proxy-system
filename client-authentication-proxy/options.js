#!/usr/bin/env nodejs

'use strict';

const assert = require('assert');
const path = require('path');
const process = require('process');
const minimist = require('minimist')
const OPTS = [['d', 'ssl-dir' ]];
const DEFAULT_SSL_DIR = '.';

function usage(prg) {
  const opts = OPTS.map(function(opt) {
    const value = opt[1].replace('-', '_').toUpperCase();
    return `[ -${opt[0]}|--${opt[1]} ${value} ]`
  });
  console.error(`usage: ${path.basename(prg)} ${opts.join(' ')} PORT WS_URL`);
  process.exit(1);
}

function getOptions(argv) { 

  const opts0 = OPTS.reduce((a, b) => a.concat(b), []);
  const opts = minimist(argv.slice(2));
  if (opts._.length !== 2) usage(argv[1]);
  for (let k of Object.keys(opts)) {
    if (k === '_') continue;
    if (opts0.indexOf(k) < 0) {
      console.error(`bad option '${k}'`);
      usage(argv[1]);
    }
  }

  return {
    port: opts._[0],
    sslDir: opts.d || opts['ssl-dir'] || DEFAULT_SSL_DIR,
    wsUrl: opts._[1]
  };
}

module.exports = {
  options: getOptions(process.argv)
};

if (!module.parent) {
  console.log(getOptions(process.argv));
}



