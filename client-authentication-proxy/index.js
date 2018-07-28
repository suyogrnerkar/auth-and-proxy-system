#!/usr/bin/env nodejs

const assert = require('assert');
const process = require('process');
const options = require('./options.js');
const server = require('./server/server');
const model = require('./model/model');

const model1 = new model.Model(options.wsUrl);
server.serve(options.options, model1);

