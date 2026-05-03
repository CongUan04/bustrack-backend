/**
 * socket.js — Singleton giữ instance của Socket.io
 * Giải quyết vấn đề circular dependency giữa server.js và các controller
 */
let _io = null;

module.exports = {
    setIo: (io) => { _io = io; },
    getIo: () => _io,
};
