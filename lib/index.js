"use strict";

const http = require("http");
const https = require("https");

const createAgentClass = require("./createAgentClass");

exports.HttpAgent = createAgentClass(http.Agent);
exports.HttpsAgent = createAgentClass(https.Agent);
