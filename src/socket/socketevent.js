const {   
    producerAddCandidate,
    sendNotify,
    updateProducer,
    removeProducerWhenDisconectedFromSocket,
    endCall,
    consumerUpdate,
    consumerSdpProcess,
    screenAddCandidate
} = require('../producer')




module.exports = (io)=>{

io.on('connection', async function(socket) {


    console.log("new connection: " + socket.id);
    

    socket.on("producer-candidate-from-client", function(data) {
        producerAddCandidate(data['producer_id'], data['candidate']);
    });
   
   

    
   
    socket.on("update-data", function(data) {
        updateProducer(data);
    });

    // 1
    /**
     * @param {Map} data {
     * producer_id
     * }
     */
    socket.on("consumer-update", function(data) {
        consumerUpdate(data["producer_id"])
    });
    // 2
    /**
     * @param {Map} data{
     * producer_id,
     * sdp -> answer
     * }
     */
    socket.on("consumer-sdp", function(data) {
        consumerSdpProcess(data['producer_id'], data["sdp"]);
    });
    // ---------------------------------------------------------
    /**
     * @param {Map} data {producer_id, room_id, message}
     */
    socket.on("send-message", function(data) {
        sendNotify(data["room_id"], data["producer_id"], "message", data["message"])
    });

    /**
     * @param {Map} data {producer_id, room_id}
     */
    socket.on("end-call", function(data) {
        try {
            console.log("\x1b[35m", "END CALL --------------", "\x1b[0m");
            endCall(data["room_id"], data["producer_id"])
        } catch (e) {
            console.log(e)
        }
    })

    socket.on('disconnect', () => {
        console.log("User disconnected: " + socket.id)
        removeProducerWhenDisconectedFromSocket(socket.id)
    })
})}