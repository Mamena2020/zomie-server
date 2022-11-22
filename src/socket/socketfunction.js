// const server = 
var io = null

/**
 * @param  socket_id socket id target send
 * @param {object} data ice candidate from server to client
 * @return void
 */
 function socket_ProducerCandidateToClient(socket_id, data) {
    io.to(socket_id).emit("producer-candidate-from-server", data)
}


/**
 * @param  socket_id socket id target send
 * @param {Map} data  {candidate,producer_id} candidate from server to client & producer_id 
 * @return void
 */
function socket_ConsumerCandidateToClient(socket_id, data) {
    io.to(socket_id).emit("consumer-candidate-from-server", data)
}


/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function socket_ProducerEventNotify(socket_id, data) {
    console.log("notify " + data["type"])
    io.to(socket_id).emit("producer-event", data)
}

function socket_ConsumerSdpFromServer(socket_id, data) {
    console.log("consumer-sdp-from-server")
    
    io.to(socket_id).emit("consumer-sdp-from-server", data)
}

/**
 * 
 * @param {String} socket_id 
 * @param {Map} data {
 * producer_id,
 * room_id
 * 
 * } 
 */
function socket_ConsumerUpdateFromServer(socket_id, data) {
    console.log("consumer-update-from-server")
    io.to(socket_id).emit("consumer-update-from-server", data)
}

async function socket_GetSocketById(socket_id)
{
    return io.sockets.sockets.get(socket_id);
}

function init(sio)
{
    io = sio;
}

module.exports =  {
    init,
    socket_ProducerCandidateToClient,
    socket_ConsumerCandidateToClient,
    socket_ProducerEventNotify,
    socket_ConsumerSdpFromServer,
    socket_GetSocketById,
    socket_ConsumerUpdateFromServer
}