
var io = null

/**
 * @param  socket_id socket id target send
 * @param {object} data ice candidate from server to client
 * @return void
 */
 function candidateToClient(socket_id, data) {
    io.to(socket_id).emit("candidate-to-client", data)
}


/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function notify(socket_id, data) {
    console.log("notify from server" + data["type"])
    io.to(socket_id).emit("notify-from-server", data)
}

function sdpFromServer(socket_id,data)
{
    console.log("sdpFromServer")
    io.to(socket_id).emit("sdp-from-server", data)
}



function updateConsumers(socket_id,data)
{
    console.log("update-consumers")
    io.to(socket_id).emit("update-consumers", data)
}

async function getSocketById(socket_id)
{
    return io.sockets.sockets.get(socket_id);
}

function init(sio)
{
    io = sio;
}

module.exports =  {
    init,
    candidateToClient,
    notify,
    getSocketById,
    sdpFromServer,
    updateConsumers
}