
var io = null

/**
 * @param  socket_id socket id target send
 * @param {object} data ice candidate from server to client
 * @return void
 */
 function producerCandidateToClient(socket_id, data) {
    io.to(socket_id).emit("producer-candidate-from-server", data)
}


/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function producerEventNotify(socket_id, data) {
    console.log("notify " + data["type"])
    io.to(socket_id).emit("producer-event", data)
}

function newUserJoin(socket_id,data)
{
    console.log("newUserJoin")
    io.to(socket_id).emit("new-user-join-from-server", data)
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
    producerCandidateToClient,
    producerEventNotify,
    getSocketById,
    newUserJoin,
    updateConsumers
}