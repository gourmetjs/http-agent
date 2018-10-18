"use strict";

const net = require("net");
const http = require("http");
const timedOut = require("timed-out");

module.exports = function createAgentClass(BaseClass) {
  return class KeepAliveAgent extends BaseClass {
    constructor(options) {
      super(Object.assign({
        // These are standard Agent options but different default values which
        // make more sense to most use cases.
        keepAlive: true,
        keepAliveMsecs: 30 * 1000,
        maxSockets: 128,
        maxFreeSockets: 32,

        // If non-zero, this enables TCP keepalive probes for active sockets
        // with a given interval. `keepAliveMsecs` controls the same property
        // for free sockets in the pool.
        activeSocketKeepAlive: 0,

        // If the connection cannot be established and the 'socket' event is
        // not emitted by the specified time, the request will be aborted.
        connectTimeout: 30 * 1000,

        // If there is no activity in the socket for the specified time,
        // the request will be aborted and socket will be destroyed.
        // If you increase this value, you should also think about enabling
        // `activeSocketKeepAlive` to prevent a silent cutoff by intermediate
        // network nodes.
        idleTimeout: 30 * 1000,

        // If non-zero, this enables TCP keepalive probes for the underlying
        // socket of WebSocket connection.
        // Please note that, to apply this value, you should call `configWebSocket()`.
        webSocketKeepAlive: 0,

        // If there is no activity in the socket for the specified time,
        // the underlying socket of WebSocket connection will be destroyed.
        webSocketIdleTimeout: 0,

        // Gets notified when a new ClientRequest object is attached to this agent.
        onRequest: null,

        // Gets notified when a socket becomes active.
        onSocket: null,

        // Gets notified when a socket is configured as an active WebSocket
        // through `configWebSocket`.
        onWebSocket: null
      }, options));
    }

    addRequest(req, ...args) {
      super.addRequest(req, ...args);

      const options = this.options;

      if (options.connectTimeout || options.idleTimeout) {
        timedOut(req, {
          connect: options.connectTimeout,
          socket: options.idleTimeout
        });
      }

      // 'socket' event will be emitted in the next event tick even if
      // `req.socket` was assigned inside `super.addRequest()`.`
      req.once("socket", socket => {
        // Turn off Nagle algorithm
        socket.setNoDelay();

        // We should always initialize keep-alive property of a socket because
        // reused socket from the free sockets pool carries the property that
        // was configured when it was put in the pool.
        if (options.activeSocketKeepAlive)
          socket.setKeepAlive(true, options.activeSocketKeepAlive);
        else
          socket.setKeepAlive(false);

        if (options.onSocket)
          options.onSocket.call(this, socket, req);
      });

      if (options.onRequest)
        options.onRequest.call(this, req);
    }

    // Initial handshake of WebSocket is controlled by
    // `activeSocketKeepAlive`, `connectTimeout` and `idleTimeout` just
    // like regular HTTP requests.
    // Once the WebSocket connection is established, you should call
    // this method to configure the underlying socket with more appropriate
    // values because the socket is detached from the agent and kept being used.
    configWebSocket(socket) {
      if (!(socket instanceof net.Socket))
        throw Error("'socket' is not an instance of net.Socket!");

      const req = socket._httpMessage;

      if (!(req instanceof http.ClientRequest))
        throw Error("'socket._httpMessage' is not an instance of http.ClientRequest!");

      const options = this.options;

      if (options.webSocketKeepAlive)
        socket.setKeepAlive(true, options.webSocketKeepAlives);
      else
        socket.setKeepAlive(false);

      // We use `timed-out` to configure timeout values. One problem of
      // `timed-out` is, it doesn't support removal of timeout event handler
      // it set. This seems OK for regular requests but causes issues when we
      // detach the socket from agent and keep using it.
      // We can workaround this problem by removing all "timeout" handlers
      // here before setting a new one.
      req.removeAllListeners("timeout");

      if (options.webSocketIdleTimeout) {
        socket.setTimeout(options.webSocketIdleTimeout, () => {
          socket.destroy();
        });
      }

      if (options.onWebSocket)
        options.onWebSocket.call(this, socket, req);
    }
  };
};
