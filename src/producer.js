const webrtc = require("wrtc")
const { v4: uuidv4 } = require('uuid')
const {   sdpFromJsonString,
    sdpToJsonString} = require("./utils")
const {rooms,producers}  = require('./data')

const { socket_ProducerCandidateToClient,
    socket_ConsumerCandidateToClient,
    socket_ProducerEventNotify,
    socket_ConsumerSdpFromServer,
    socket_GetSocketById
} = require('./socket/socketfunction')





const configurationPeerConnection = {
    sdpSemantics: "unified-plan",
    iceServers: [{
            "urls": "stun:stun.stunprotocol.org"
        },

    ]
}

const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

class Producer {
    constructor(
        socket_id = null,
        room_id = null,
        id = null,
        name = null,
        has_video = true,
        has_audio = true,
        peer = new webrtc.RTCPeerConnection(),
        peerConsumer = new webrtc.RTCPeerConnection(),
        stream =  webrtc.MediaStream()
    ) {
        this.socket_id = socket_id
        this.room_id = room_id
        this.id = id
        this.name = name
        this.has_video = has_video
        this.has_audio = has_audio
        this.peer = peer
        this.peerConsumer = peerConsumer
        this.stream = stream
    }
}



/**
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  producer index
 */
 async function createProducer(
    socket_id,
    room_id,
    producer_id,
    producer_name,
    has_video = true,
    has_audio = true,
    sdp,
    use_sdp_transform = false) {

    if (producer_id == null || producer_id == undefined || producer_id == "") {
        producer_id = uuidv4()
    }
    if (producer_name == undefined || producer_name == null) {
        producer_name = "user-" + String(Date.now())
    }
    if (producers[producer_id] != null) {
        if (producers[producer_id].room_id != room_id) {
            console.log("exist before")
        }
    }
    var producer = new Producer(
        socket_id,
        room_id,
        producer_id,
        producer_name,
        has_video,
        has_audio,
        new webrtc.RTCPeerConnection(configurationPeerConnection, offerSdpConstraints),
        new webrtc.RTCPeerConnection(configurationPeerConnection, offerSdpConstraints),
        new webrtc.MediaStream(),
    )

    producers[producer_id] = producer
    producers[producer_id].peer.addTransceiver("video", { direction: "sendrecv" })
    producers[producer_id].peer.addTransceiver("audio", { direction: "sendrecv" })
    producers[producer_id].peer.onnegotiationneeded = (e) => {
        console.log("\x1b[34m", "producers: onnegotiationneeded " + producers[producer_id].name, "\x1b[0m")
    }

    producerOnMediaStream(producer_id)
        // --------------------------------- process offer answer sdp
    await producerWebRTCProcess(producer_id, sdp, use_sdp_transform)
    producerOnIceConnectionStateChange(producer_id)
        // --------------------------------- send ice candidate to client
    producerOnIceCandidate(producer_id)
    return producer_id;
}


// ======================================================== producer WebRTC


/**
 * @param  id producer id
 * @return void
 */
async function producerOnMediaStream(id) {
    try {
        producers[id].peer.ontrack = (e) =>
            producers[id].stream = e.streams[0];
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id producer id
 * @param  sdp sdp offer from client in json
 * @return sdp answer
 */
async function producerWebRTCProcess(id, sdp, use_sdp_transform) {
    try {
        var newsdp
        console.log("use_sdp_transform");
        console.log(use_sdp_transform);
        if (use_sdp_transform) {
            newsdp = await sdpFromJsonString(sdp)
        } else {
            newsdp = sdp
        }
        const desc = new webrtc.RTCSessionDescription(newsdp);
        await producers[id].peer.setRemoteDescription(desc);
        // const answer = await producers[id].peer.createAnswer({ 'offerToReceiveVideo': 1 });
        const answer = await producers[id].peer.createAnswer();
        await producers[id].peer.setLocalDescription(answer);
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}




/**
 * @param  id producer id
 * @return void
 */
async function producerOnIceConnectionStateChange(id) {
    producers[id].peer.oniceconnectionstatechange = async(e) => {
        try {
            if (producers[id] != null) {
                const connectionStatus2 = producers[id].peer.iceConnectionState;
                if (["disconnected", "failed", "closed"].includes(connectionStatus2)) {
                    console.log("\x1b[31m", "producers: " + producers[id].id + " - " + connectionStatus2, "\x1b[0m")
                    endCall(producers[id].room_id, id)
                }
                if (["connected"].includes(connectionStatus2)) {
                    console.log("\x1b[34m", "producers: " + producers[id].id + " - " + connectionStatus2, "\x1b[0m")
                }
            }
        } catch (e) {
            console.log(e);
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
    }
}


/**
 * @param id producer id
 * @return void
 */
async function producerOnIceCandidate(id) {
    try {
        producers[id].peer.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            try {
                // console.log("ice candidate send to: " + producers[i].socket_id)
                var newCandidate = {
                    'candidate': String(e.candidate.candidate),
                    'sdpMid': String(e.candidate.sdpMid),
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                }
                var data = {
                        "candidate": newCandidate,
                        "producer_id": producers[id].id,
                        "room_id": producers[id].room_id
                    }
                    // console.log(data);
                socket_ProducerCandidateToClient(producers[id].socket_id, data)
            } catch (e) {
                console.log(e);
                console.log("\x1b[31m", "ERROR................", "\x1b[0m");
            }

        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * add candidate from client to server 
 * @param {String} producer_id 
 * @param {Map} candidate : {candidate, sdpMid, sdpMLineIndex }
 */
async function producerAddCandidate(producer_id, candidate) {

    try {
        console.log(producer_id)
        if (producers[producer_id] != null) {
            console.log("add candidate in server")
            producers[producer_id].peer.addIceCandidate(new webrtc.RTCIceCandidate(candidate))
        } else {
            console.log("producer not found when add candidate")
        }
    } catch (e) {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}





/**
 * 
 * @param {int}  producer_id producer id 
 * @param {int} room_id room id
 * @param {String} type type of notify: "join" | "leave" | "update" | "message" | "start_screen" | "stop_screen"
 * @param {String} message message
 */
async function sendNotify(room_id, producer_id, type, message = '', ) {
    try {
        console.log("starting notify " + type)
        var data = {
            "room_id": room_id,
            "producer": {
                "id": producer_id,
                "name": producers[producer_id].name,
                "stream_id": producers[producer_id].stream.id,
                "has_video": producers[producer_id].has_video,
                "has_audio": producers[producer_id].has_audio,
            },
            "producers": type == "join" ?
                getProducersFromRoomToArray(room_id) : type == "leave" ? getProducersFromRoomToArray(room_id, producer_id) : [],
            "type": type,
            "message": message
        }
        console.log(data)
        for (let p in rooms[room_id].producers) {
            // if (p != producer_id && producers[p] != null) {
            if (producers[p] != null) {
                if (type == "join" || type == "leave") {
                    // send to all in the room
                    socket_ProducerEventNotify(producers[p].socket_id, data)
                } else {
                    // except self
                    if (p != producer_id) {
                        socket_ProducerEventNotify(producers[p].socket_id, data)
                    }
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
}


// -------------------------------------------------------------------------
/**
 * @param  id producer id
 * @return producer index
 */
async function updateProducer(data) {
    try {
        /**
         * data:
         *  - socket_id,
         *  - room_id
         *  - producer:
         *             - id
         *             - name
         *             - has_video
         *             - has_audio
         */

        console.log("\x1b[35m", "UPDATE DATA PRODUCER", "\x1b[0m");
        console.log(data);
        // let socket = await io.sockets.sockets.get(data["socket_id"])
        let socket =  await socket_GetSocketById(data["socket_id"])
        let producer = producers[data["producer"]["id"]]
        let room = rooms[data["room_id"]]
        if (socket != null && producer != null && room != null) {
            // update on producers
            producers[producer.id].socket_id = socket.id
            producers[producer.id].name = data["producer"]["name"]
            producers[producer.id].has_video = data["producer"]["has_video"]
            producers[producer.id].has_audio = data["producer"]["has_audio"]
                // update on rooms
            if (rooms[room.id].producers[producer.id] != null) {
                rooms[room.id].producers[producer.id].name = data["producer"]["name"]
                rooms[room.id].producers[producer.id].has_video = data["producer"]["has_video"]
                rooms[room.id].producers[producer.id].has_audio = data["producer"]["has_audio"]
            }
            sendNotify(room.id, producer.id, "update");
        }

    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  socket_id producer socket id
 * @return producer id
 */
async function getProducerIdBySocketId(socket_id) {
    for (let p in producers) {
        if (producers[p].socket_id == socket_id) {
            return p
        }
    }
    return null
}

/**
 * @param  id producer id
 * @return void
 */
async function removeProducer(id) {
    try {
        if (producers[id] != null) {
            console.log("remove producer")
            await removeProducerFromRoom(id, producers[id].room_id)
            producers[id].peer.close()
            producers[id].peer = null
            producers[id].peerConsumer.close()
            producers[id].peerConsumer = null
            delete producers[id];
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id producer id
 * @return void
 */
async function removeProducerFromRoom(producer_id, room_id) {
    try {
        if (rooms[room_id] != null && rooms[room_id].producers[producer_id] != null) {
            delete rooms[room_id].producers[producer_id]
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


async function removeProducerBySocketId(socket_id) {
    try {
        let id = await getProducerIdBySocketId(socket_id)
        if (id != null) {
            console.log("remove producer when disconected")
            endCall(producers[id].room_id, id)
        } else {
            console.log("not found - get producer by socket ")
        }
    } catch (e) {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


// will remove producer after 10 seconds of disconected
async function removeProducerWhenDisconectedFromSocket(socket_id) {
    setTimeout(async() => {
        await removeProducerBySocketId(socket_id)
    }, 5000); // 5 second after disconected will remove producer by socket id
}



// ================================================================================================ 
// ================================================================================================ consumer functions
// ================================================================================================ 




/**
 * flow->
 * after user join room, then will notif to all user via socket.
 * each client will access this updateConsumer to create consumer for then to stream media
 */
async function consumerUpdate(producer_id) {
    if (producers[producer_id] == null)
        return;
    let room_id = producers[producer_id].room_id
        //-------------------------------------------------------------------- clear old track 
    try {
        if(producers[producer_id].peerConsumer!=null)
        {
            if( producers[producer_id].peerConsumer.getSenders()!=undefined && producers[producer_id].peerConsumer.getSenders()!=null )
            {
                for (let _sender of producers[producer_id].peerConsumer.getSenders()) {
                    await producers[producer_id].peerConsumer.removeTrack(_sender);
                }
            }
        }
        else
        {
            producers[producer_id].peerConsumer = new webrtc.RTCPeerConnection()
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    //-------------------------------------------------------------------- add new track 
    try {
        for (let id in rooms[room_id].producers) {
            if (producers[id] != null && id != producer_id) {
                // ---------------------------------------------------------- add new track from other users in the room
                for (let track of producers[id].stream.getTracks()) {
                    await producers[producer_id].peerConsumer.addTrack(track, producers[id].stream)
                }
                // ----------------------------------------------------------
            }
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }

    consumerOnIceCandidate(producer_id)
    await consmerRenegotiation(producer_id)
}


async function consmerRenegotiation(producer_id) {
    try {
        const offer = await producers[producer_id].peerConsumer.createOffer({ 'offerToReceiveVideo': true });
        await producers[producer_id].peerConsumer.setLocalDescription(offer);
        var localDesc = await producers[producer_id].peerConsumer.localDescription
        var sdp = await sdpToJsonString(localDesc)
        _data = {
            "producer_id": producer_id,
            "sdp": sdp
        }
        socket_ConsumerSdpFromServer(producers[producer_id].socket_id, _data)
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

async function processSdpConsumer(producer_id, sdp) {

    if (producers[producer_id] == null)
        return;

    var newsdp = await sdpFromJsonString(sdp)
    const remoteDesc = new webrtc.RTCSessionDescription(newsdp);
    await producers[producer_id].peerConsumer.setRemoteDescription(remoteDesc);
}

async function consumerOnIceCandidate(producer_id) {
    try {
        producers[producer_id].peerConsumer.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            try {
                // console.log("ice candidate send to consumer: " + consumers[id].socket_id)
                var newCandidate = {
                    'candidate': String(e.candidate.candidate),
                    'sdpMid': String(e.candidate.sdpMid),
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                }
                var data = {
                    "candidate": newCandidate,
                    "producer_id": producers[producer_id].id,
                }
                socket_ConsumerCandidateToClient(producers[producer_id].socket_id, data)
            } catch (e) {
                console.log(e);
                console.log("\x1b[31m", "ERROR................", "\x1b[0m");
            }

        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


async function endCall(room_id, producer_id) {
    if (rooms[room_id] != null && producers[producer_id] != null) {
        await sendNotify(room_id, producer_id, "leave")
        await removeProducer(producer_id)
    }
}


/**
 * @param  room_id room id
 * @param  producer_id producer id
 * @return room id
 */
 async function addProducerToRoom(room_id, producer_id) {
    var id = null
    try {
        //xxx store id,name, has_video, has_audio
        if (rooms[room_id] != null) {
            rooms[room_id].producers[producer_id] = {
                id: producers[producer_id].id,
                name: producers[producer_id].name,
                has_video: producers[producer_id].has_video,
                has_audio: producers[producer_id].has_audio,
            }
            id = room_id
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return id
}

function getProducersFromRoomToArray(room_id, producer_id_except = null) {
    var _producers = [];
    try {
        if (rooms[room_id] != null) {
            for (let p in rooms[room_id].producers) {
                if (producers[p] != null && p != producer_id_except) {
                    _producers.push({
                        "id": producers[p].id,
                        "name": producers[p].name,
                        "has_video": producers[p].has_video,
                        "has_audio": producers[p].has_audio,
                        "stream_id": producers[p].stream.id
                    });
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
    console.log("getProducersFromRoomToArray")
    console.log(_producers)
    return _producers;
}


module.exports = {
    createProducer,
    producerOnMediaStream,
    producerWebRTCProcess,
    producerOnIceConnectionStateChange,
    producerOnIceCandidate,
    producerAddCandidate	,
    addProducerToRoom,
    getProducersFromRoomToArray,
    sendNotify,
    updateProducer,
    getProducerIdBySocketId,
    removeProducer,
    removeProducerFromRoom,
    removeProducerBySocketId,
    removeProducerWhenDisconectedFromSocket,
    endCall,
    consumerUpdate,
    processSdpConsumer
}