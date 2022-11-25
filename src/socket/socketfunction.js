
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
 * @param  socket_id socket id target send
 * @param {Map} data  {candidate,producer_id} candidate from server to client & producer_id 
 * @return void
 */
function consumerCandidateToClient(socket_id, data) {
    io.to(socket_id).emit("consumer-candidate-from-server", data)
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

function consumerSdpFromServer(socket_id, data) {
    console.log("consumer-sdp-from-server")
    io.to(socket_id).emit("consumer-sdp-from-server", data)
}


function newUserJoin(socket_id,data)
{
    console.log("newUserJoin")
    io.to(socket_id).emit("new-user-join-from-server", data)
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
function consumerUpdateClientStream(socket_id, data) {
    console.log("consumer-update-client-stream")
    io.to(socket_id).emit("consumer-update-client-stream", data)
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
    consumerSdpFromServer,
    consumerCandidateToClient,
    consumerUpdateClientStream,
    newUserJoin
}