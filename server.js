const express = require('express')
const app = express()
const server = require('http').Server(app) // running express on http
const io = require('socket.io')(server) // running socket io server
const ip = "192.168.1.9"
const port = 3000
server.listen(port, ip, () => {
    console.log("server running.")
})


//Whenever someone connects this gets executed
io.on('connection', async function(socket) {

    console.log("new connection")
        // socket.on('test', () => {
        //     console.log("testss")
        // })

    socket.on('join-room', (roomId, userId) => {
        console.log("join room", roomId, userId)
        socket.join(roomId)
        socket.to(roomId).broadcast.emit('user-connected', userId)
    })

    io.on('disconnect', socket => {
        console.log("someone disconnected")
    })
})

// var port = 3000;
// var ip = "192.168.1.9";
// const http = require('http').createServer();
// const sio = require('socket.io')(http);

// //Whenever someone connects this gets executed
// sio.on('connection', async function(socket) {
//     console.log("new connection")
// })

// http.listen(port, ip, function() {
//     console.log('Server active. listening on :' + ip + ":" + port);
// });