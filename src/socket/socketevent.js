const producerService = require('../services/producerService')


module.exports = (io)=>{

io.on('connection', async function(socket) {


    console.log("new connection: " + socket.id);
    

    socket.on("producer-candidate-from-client", function(data) {
        producerService.addCandidate(data['producer_id'], data['candidate']);
    })
   
    socket.on("update-data", function(data) {
        producerService.updateData(data);
    })

    socket.on("negotiation-sdp", function(data) {
        producerService.handleRemoteSdp(data['producer_id'], data["sdp"]);
    })
    // ---------------------------------------------------------
    /**
     * @param {Map} data {producer_id, room_id, message}
     */
    socket.on("notify-server", function(data) {
        producerService.notify(data["room_id"], data["producer_id"], data["type"], data["message"]??'')
    })

    /**
     * @param {Map} data {producer_id, room_id}
     */
    socket.on("end-call", function(data) {
        try {
            console.log("\x1b[35m", "END CALL --------------", "\x1b[0m");
            producerService.endCall(data["room_id"], data["producer_id"])
        } catch (e) {
            console.log(e)
        }
    })

    socket.on('disconnect', () => {
        console.log("User disconnected: " + socket.id)
        producerService.removeWhenDisconectedFromSocket(socket.id)
    })
})}