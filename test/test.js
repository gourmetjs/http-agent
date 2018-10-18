"use strict";

const got = require("got");
const test = require("tape");
const {HttpAgent, HttpsAgent} = require("..");

const options = {
  onSocket(socket) {
    if (!this._usedSockets)
      this._usedSockets = new Set();
    this._usedSockets.add(socket);
  }
};

const agent = {
  http: new HttpAgent(options),
  https: new HttpsAgent(options)
};

test("HTTP requests", async t => {
  try {
    const res = await got("http://example.com", {agent});
    const m = /<title>.*<\/title>/.exec(res.body);
    t.equal(m[0], "<title>Example Domain</title>");

    try {
      await got("http://example.com/foo", {agent});
    } catch (err) {
      t.equal(err.statusCode, 404);
    }

    t.equal(agent.http._usedSockets.size, 1, "socket should be reused");

    t.end();
  } catch (err) {
    t.end(err);
  }
});

test("HTTPS requests", async t => {
  try {
    const res = await got("https://example.com", {agent});
    const m = /<title>.*<\/title>/.exec(res.body);
    t.equal(m[0], "<title>Example Domain</title>");

    try {
      await got("http://example.com/foo", {agent});
    } catch (err) {
      t.equal(err.statusCode, 404);
    }

    t.equal(agent.https._usedSockets.size, 1, "socket should be reused");

    t.end();
  } catch (err) {
    t.end(err);
  }
});
