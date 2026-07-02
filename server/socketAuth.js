'use strict';

function createSocketAuthMiddleware(verifyToken) {
  return async function socketAuthMiddleware(socket, next) {
    const accessToken = socket.handshake.auth?.accessToken;

    if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
      next(new Error('unauthorized'));
      return;
    }

    let user;

    try {
      user = await verifyToken(accessToken);
    } catch {
      next(new Error('unauthorized'));
      return;
    }

    if (!user || !user.id) {
      next(new Error('unauthorized'));
      return;
    }

    socket.data.userId = user.id;
    socket.data.user = {
      id: user.id,
      email: user.email,
    };

    next();
  };
}

module.exports = { createSocketAuthMiddleware };
