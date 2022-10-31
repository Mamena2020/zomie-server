const port = 443
const host = '192.168.1.9'

//-------------------------------------------------------------------------
const express = require('express');
const { ExpressPeerServer } = require('peer');
const app = express();
app.get('/', (req, res, next) => res.send('Hello world!'));
const http = require('http');
const server = http.createServer(app);
const peerServer = ExpressPeerServer(server, {
    debug: true,
    allow_discovery: true,
    ssl: {
        key: '',
        cert: ''
    },
    key: 'peerjs',
    // port: port,
    proxied: false
        // path: '/vista'
});
app.use('/peerjs', peerServer);
server.listen(port, host, () => {
    console.log("listen to :" + host + ":" + port)
});

peerServer.on('connection', function(id) {
    console.log('Peer connected with id:', id);
});

peerServer.on('disconnect', function(id) {
    console.log('Peer %s disconnected', id);
});
//-------------------------------------------------------------------------

// var PeerServer = require('peer').PeerServer;
// var server2 = PeerServer({
//     port: port,
//     host: host,
//     path: '/peerjs',
//     // allow_discovery: true,
//     key: "peerjs",

// });

// server2.listen(() => {
//     console.log("listen on " + host + ":" + port)
// });

// server2.on("connection", (e) => {
//     console.log("new connect");
//     console.log(e);
// })


// 3048981
// 3102765