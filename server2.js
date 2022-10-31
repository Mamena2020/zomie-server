// -----------------------------------------------------------------------------------------------
const host = "192.168.1.8"
const port = 5000

// -----------------------------------------------------------------------------------------------

const express = require('express')
const app = express()
const server = require('http').Server(app) // running express on http
const io = require('socket.io')(server) // running socket io server
const cors = require('cors');
const webrtc = require("wrtc")
const { MediaStream } = require('wrtc')
const bodyParser = require('body-parser')
const { v4: uuidv4 } = require('uuid')
const sdpTransform = require('sdp-transform');

// -----------------------------------------------------------------------------------------------

const configurationPeerConnection = {
    iceServers: [{
            "urls": "stun:stun.stunprotocol.org"
                // urls: "stun:stun.l.google.com:19302?transport=tcp"
        },
        // {
        //     // "urls": "stun:stun.stunprotocol.org"
        //     "urls": "stun:stun.l.google.com:19302?transport=tcp"
        // }
    ]
}

const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

// -----------------------------------------------------------------------------------------------
app.use(cors())

// support parsing of application/json type post data

app.use(express.static('public'));


app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));

server.listen(port, host, () => {
    console.log("server running : " + host + ":" + port)
})




app.get("/run", async(req, res) => {

    let i = await createRoom()
    rooms[i].producer_ids.push("7879")
    rooms[i].producer_ids.push("2879")
    data = {
        "room_id": rooms[i].id
    }

    res.json({ "status": "run", "data": data })
})
app.get("/remove", async(req, res) => {
    var m = "remove failed. room not found"
    console.log(req.query.room_id)
    let i = await roomIndex(req.query.room_id)
    if (i >= 0) {
        let x = rooms[i].producer_ids.findIndex((e) => e == req.query.producer_id)
        m = "remove failed. producer not found"
        if (x >= 0) {
            rooms[i].producer_ids.splice(x, 1)
            m = "remove success"
        }
    }
    res.json({ "status": m })
})
app.get("/check", async(req, res) => {
    (req, res)

    setInterval(() => {
        console.log("room length: " + rooms.length)
    }, 1000);
    res.json({ "status": "check" })
})


/**
 * new update
 * creat room only return room id,
 * add room id in producer model
 * remove producer id from producer_ids in room object
 * 
 * next.
 *  anytime user reconnect socket then have to update new socket id to producer list by producer_id
 *  
 */

/**
 *  =========================================== CASE FLOW ============================================
 *  
 * [1]. Starting call (User A)
 * 
 *     1. User(A) will create room, and as an producer to streaming the media
 *        - webRTC producer created for User(A) 
 *        - store producer id into room (producer_ids)
 *        - send back room id to user(A)
 * 
 *     2. User(A) will send room id via FCM to notify other user(B) that, they already calling 
 *     #failed case: ...
 * 
 * [2]. Answer incoming call (User B)
 * 
 *     1. User(B) answer the call & create as producer and streaming the media
 *        - webRTC producer created for User(B)
 *        - store producer id into room (producer_ids)
 * 
 *     2. notify(socket) to all producers(including User B) for check new update of producer_ids in room
 *
 * [3]. Listen as Consumer (All user in the room)
 * 
 *     1. User(All) after get new update of producer_ids
 *        - compare list of consumer(in client list) with list of producer_ids(new update)
 *        - get all new producer_ids of comparing(not including current producer id)
 * 
 *     2. Create consumer by looping new list of producer_ids   
 *        - webRTC consumer created & listen to media streaming from producer  
 *  
 *  [4]. User leave/end the call   
 * 
 *     1. end producer in client side 
 *        - producer in server side will detect lost connect from client
 *        - delete current producer in server
 *        - delete all consumer on server side that using producer id
 *        - user(all) checking if consumer lost connect then consomer in all client will remove webRTC consumer
 *        
 *     2. room monitoring
 *        - when producer & consumer not exist but still room, room have method service interval for checking
 *        - will remove current room when producer equal or less than 1 producer_ids
 * 
 *     3. result
 *        - producer deleted from server & client   
 *        - consumer deleted from server & client
 *        - room deleted from server   
 *        
 */


//-------------------------------------------------------------------------
const producers = []
const consumers = []
const rooms = []
const timeIntervalMonitoringRoomInSec = 1000 * 60

class Producer {
    constructor(
        id = null,
        socket_id = null,
        peer = new webrtc.RTCPeerConnection(),
        stream = new MediaStream(),
        room_id = null
    ) {
        this.id = id
        this.socket_id = socket_id
        this.peer = peer
        this.stream = stream
        this.room_id = room_id
    }
}

class Consumer {
    constructor(
        id = null,
        producer_id = null,
        socket_id = null,
        peer = new webrtc.RTCPeerConnection(),
    ) {
        this.id = id
        this.producer_id = producer_id
        this.socket_id = socket_id
        this.peer = peer
    }
}




class Room {
    constructor(id, producer_ids = [], monitor = function() {}) {
        this.id = id
        this.producer_ids = producer_ids
        this.monitor = monitor
    }
}

// --------------------------------------------------------------------------------------------------------
app.get("/create-room",
    /**
     * @param {Map} body is map of {
  
     *  }
     */
    async function({ body }, res) {
        try {
            var room_index = await createRoom()
            if (room_index < 0) {
                throw "failed to create room"
            }
            console.log("Creating room: " + rooms[room_index].id)
            var data = {
                room_id: rooms[room_index].id,
            }
            res.status(200)
            res.json(data)
        } catch (e) {
            console.log("\x1b[31m", "ERROR................", "\x1b[0m")
            console.log(e)

        }
        res.status(409)
    })

// --------------------------------------------------------------------------------------------------------
app.post("/join-room",
    /**
     * @param {Map} body is map of {socket_id,sdp, room_id}
     */
    async function({ body }, res) {
        try {
            console.log("join room")
            console.log(body.socket_id)
            console.log(body.sdp)
            console.log(body.room_id)
            console.log(body.use_sdp_transform);

            var use_sdp_transform = false;
            if (body.use_sdp_transform === true || body.use_sdp_transform == undefined) {
                use_sdp_transform = true
            }
            // socket
            var socket = await io.sockets.sockets.get(body.socket_id)
                // create producer
            var producer_index = await createProducer(socket.id, body.sdp, body.room_id, use_sdp_transform)
                // search room
            var room_index = await roomIndex(body.room_id)
            if (producer_index === -1 || room_index === -1) {
                throw "not producer or room"
            }
            // add producer to room
            await addProducerToRoom(room_index, producer_index)
                // --------------------------------- send back sdp to client
            console.log("sdp local")
            var sdp = await producers[producer_index].peer.localDescription
            var newsdp
            if (use_sdp_transform) {
                newsdp = await sdpToJsonString(sdp)
            } else {
                newsdp = sdp
            }
            console.log(newsdp)
            var data = {
                sdp: newsdp,
                room_id: rooms[room_index].id,
                producer_id: producers[producer_index].id
            }

            // send new update of producer_ids in the room
            // all producer in the room can update their consumer
            socket_updateInfoRoom(room_index);

            res.status(200)
            res.json(data)
        } catch (e) {
            console.log(e)
        }
        res.status(409)
    })

// --------------------------------------------------------------------------------------------------------

app.post("/consumer",
    /**
     * @param {Map} body is map of {socket_id,sdp, producer_id}
     */
    async function({ body }, res) {
        try {
            console.log("create consumer")
            console.log(body.socket_id)
            console.log(body.sdp)
            console.log(body.producer_id)
            console.log(body.use_sdp_transform);
            var use_sdp_transform = false;
            if (body.use_sdp_transform === true || body.use_sdp_transform == undefined) {
                use_sdp_transform = true
            }
            var producer_index = await producerIndex(body.producer_id)
                // socket
            var socket = await io.sockets.sockets.get(body.socket_id)
            console.log("socket from server: " + socket.id)

            // create consumer
            if (producer_index < 0) {
                throw "failed create consumer- no producer"
            }
            var consumer_index = await createConsumer(socket.id, producer_index, body.sdp, use_sdp_transform)
            if (consumer_index < 0) {
                throw "failed create consumer- no consumer"
            }
            // --------------------------------- send back sdp to client
            var sdp = await consumers[consumer_index].peer.localDescription
            console.log("sdp local")
                // console.log(sdp)
            var newsdp
            if (use_sdp_transform) {
                newsdp = await sdpToJsonString(sdp)
            } else {
                newsdp = sdp;
            }
            console.log(newsdp)
            var data = {
                sdp: newsdp,
                consumer_id: consumers[consumer_index].id
            }
            res.status(200)
            res.json(data)
        } catch (e) {
            console.log(e);
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
        res.status(409)
    })

// --------------------------------------------------------------------------------------------------------
app.get("/producers", async(req, res) => {

        var data = [];
        for (var p of producers) {
            data.push(p.id)
        }
        console.log(data);
        res.status(200)
        res.json({
            "producer_ids": data
        })
    })
    // --------------------------------------------------------------------------------------------------------
    // -------------------------------------------------------------------------------------------------
app.get("/producer-ids", (req, res) => {
    var data = [];
    for (i in producers) {
        data.push(producers[i].id)
    }
    res.json(data);
})


// ================================================================================================ 
// ================================================================================================ socket 
// ================================================================================================ 

io.on('connection', async function(socket) {


    console.log("new connection: " + socket.id);

    // socket.on("consumer-candidate-from-client",
    //     /**
    //      * @param  {String} event string json
    //      * @return void
    //      */
    //     async function(event) {
    //         var data = await JSON.parse(event)
    //         var consumer_index = await consumerIndex(data["consumer_id"])
    //         console.log("consumer candidate from client")
    //         console.log(data["consumer_id"])
    //         console.log(data["candidate"])
    //         if (consumer_index >= 0) {
    //             for (let c of data["candidate"]) {
    //                 console.log("adding candidate")
    //                 console.log(c)
    //                 await consumers[consumer_index].peer.addIceCandidate(new webrtc.RTCIceCandidate(c))
    //             }
    //         } else {
    //             console.log("failed adding candidate")
    //             console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    //         }
    //     })

    // ---------------------------------------------------------

    /**
     * @param {Map} data {producer_id, socket_id}
     */
    socket.on("update-socket", function(data) {
        console.log("\x1b[35m", "UPDATE SOCKET", "\x1b[0m");
        producerUpdateSocket(data["producer_id"], data["socket_id"]);
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

    socket.on('disconnect', socket => {
        console.log("User disconnected")
    })
})


// ================================================================================================ 
// ================================================================================================ socket functions
// ================================================================================================ 

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
 * @param  socket_id socket id target send
 * @param {object} sdp sdp answer from server
 * @return void
 */
function socket_ProducerSdpFromServer(socket_id, sdp) {
    io.to(socket_id).emit("producer-sdp-from-server", sdp)
}

// /**
//  * @param  socket_id socket id target send
//  * @param  room_id room id already created
//  * @return void - send back room id to client when client create call
//  */
// function socket_RoomCreatedOnServer(socket_id, room_id) {
//     io.to(socket_id).emit("room-created-server", room_id)
// }

/**
 * @param  room_index room index for search producer_id
 * @return void - send list of producer ids & room_id to all producer in a room,
 */
async function socket_updateInfoRoom(room_index) {
    try {
        console.log("socket update from ROOM :" + rooms[room_index].producer_ids);

        for (var id of rooms[room_index].producer_ids) {
            try {
                var i = await producerIndex(id)
                console.log("\x1b[35m", "SEND UPDATE TO" + i, "\x1b[0m");
                if (i >= 0) {
                    let data = {
                        "room_id": rooms[room_index].id,
                        "producer_ids": rooms[room_index].producer_ids
                    }
                    io.to(producers[i].socket_id).emit("room-update-from-server", data)
                }
            } catch (e) {
                console.log(e);
                console.log("\x1b[31m", "ERROR................", "\x1b[0m");
            }
        }
    } catch (e2) {
        console.log(e2);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


async function endCall(room_id, producer_id) {
    let room_index = await roomIndex(room_id)
    if (room_index >= 0) {
        await removeProducer(producer_id)
        await socket_updateInfoRoom(room_index)
    }
}




// ================================================================================================ sdp process

/**
 * 
 * @param {String} sdp json string of sdp with structure {sdp:sdp, type:offer|answer }
 * @return map 
 */
async function sdpFromJsonString(sdpJson) {
    var session = JSON.parse(sdpJson);
    var _sdp = sdpTransform.write(session.sdp)
    var newsdp = {
        type: session.type,
        sdp: _sdp
    }
    return newsdp
}

/**
 * @param {object} sdp component {sdp:sdp, type: offer|answer}
 * @return {String} json string 
 */
async function sdpToJsonString(sdp) {
    console.log("sdp to json string")
    console.log(sdp)


    var session = sdpTransform.parse(String(sdp.sdp))
    var data = {
        type: sdp.type,
        sdp: session
    }


    return JSON.stringify(data)
}

// ================================================================================================ 
// ================================================================================================ Room functions 
// ================================================================================================ 

/**
 * @return room index
 */
async function createRoom() {
    var id = uuidv4()
    var room = new Room(
        id, [],
        roomMonitor(id)
    )
    rooms.push(room)
    return await roomIndex(id)
}


/**
 * @param  room_index room index
 * @param  producer_index producer index
 * @return void
 */
async function addProducerToRoom(room_index, producer_index) {
    try {
        rooms[room_index].producer_ids.push(producers[producer_index].id)
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

/**
 * @param  id room id
 * @return {object} room object
 */
async function getRoom(id) {
    try {
        let i = await roomIndex(id)
        if (i >= 0) {
            return rooms[i]
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return null
}

// testting performance
// http://jsben.ch/zikym
/**
 * @param  id room id
 * @return room index
 */
async function roomIndex(id) {

    // return await rooms.findIndex((e) => e.id == id) // slower methods
    var index = -1;
    for (let i = 0; i < rooms.length; i++) {
        if (rooms[i].id == id) {
            index = i;
            break;
        }
    }
    return index;
}

/**
 * @param  id room id
 * @return void
 */
async function removeRoom(id) {
    try {
        let i = await roomIndex(id)
        if (i >= 0) {
            console.log("remove room")
            await rooms.splice(i, 1)
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id room id
 * @return void - monitoring room in interval time, if producer id equal or less than 1 then will remove current room
 *              
 */
function roomMonitor(id) {
    var monitor = setInterval(async() => {
        try {
            console.log("monitoring room: " + id);
            let i = await roomIndex(id)
            if (i >= 0) {
                console.log("total producer in list:" + rooms[i].producer_ids.length)
                if (rooms[i].producer_ids.length <= 0) {
                    clearInterval(monitor)
                    await removeRoom(id)
                } else {
                    socket_updateInfoRoom(i);
                }
            } else {
                clearInterval(monitor)
            }

        } catch (e) {
            console.log(e)
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
    }, timeIntervalMonitoringRoomInSec);
}

// ================================================================================================ 
// ================================================================================================ producer functions
// ================================================================================================ 

/**
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  producer index
 */
async function createProducer(socket_id, sdp, room_id, use_sdp_transform = false) {
    var id = uuidv4()
    var producer = new Producer(
        id,
        socket_id,
        new webrtc.RTCPeerConnection(configurationPeerConnection, offerSdpConstraints),
        new MediaStream(),
        room_id
    );
    await producers.push(producer)

    var producer_index = await producerIndex(id)
    if (producer_index >= 0) {
        producerOnMediaStream(producer_index)
            // --------------------------------- process offer answer sdp
        await producerWebRTCProcess(producer_index, sdp, use_sdp_transform)
            // producerWebRTCCallback(i, )
        producerOnIceConnectionStateChange(producer_index)
            // --------------------------------- send ice candidate to client
        producerOnIceCandidate(producer_index)
    }
    return producer_index;
}


// ======================================================== producer WebRTC
//  * @param  sdp sdp offer from client
/**
 * @param  i producer index
 * @return void
 */
async function producerWebRTCCallback(i) {
    // --------------------------------- media stream
    producerOnMediaStream(i)
        // --------------------------------- detect disconnected
    producerOnIceConnectionStateChange(i)
        // --------------------------------- send ice candidate to client
    producerOnIceCandidate(i)
}


/**
 * @param  i producer index
 * @return void
 */
async function producerOnMediaStream(i) {
    try {
        producers[i].peer.ontrack = (e) =>
            producers[i].stream = e.streams[0];
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  i producer index
 * @param  sdp sdp offer from client in json
 * @return sdp answer
 */
async function producerWebRTCProcess(i, sdp, use_sdp_transform) {
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
        await producers[i].peer.setRemoteDescription(desc);
        const answer = await producers[i].peer.createAnswer({ 'offerToReceiveVideo': 1 });
        await producers[i].peer.setLocalDescription(answer);

    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}




/**
 * @param  i producer index
 * @return void
 */
async function producerOnIceConnectionStateChange(i) {
    producers[i].peer.oniceconnectionstatechange = async(e) => {
        try {
            if (producers[i]) {
                const connectionStatus2 = producers[i].peer.iceConnectionState;
                if (["disconnected", "failed", "closed"].includes(connectionStatus2)) {
                    console.log("\x1b[31m", "producers: " + producers[i].id + " - " + connectionStatus2, "\x1b[0m")
                    let room_index = await roomIndex(producers[i].room_id)
                    await removeProducer(producers[i].id)
                    socket_updateInfoRoom(room_index)
                }
                if (["connected"].includes(connectionStatus2)) {
                    console.log("\x1b[34m", "producers: " + producers[i].id + " - " + connectionStatus2, "\x1b[0m")
                }
            }
        } catch (e) {
            console.log(e);
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
    }
}


/**
 * @param  i producer index
 * @return void
 */
async function producerOnIceCandidate(i) {
    try {
        producers[i].peer.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            try {
                console.log("ice candidate send to: " + producers[i].socket_id)

                var newCandidate = {
                    'candidate': String(e.candidate.candidate),
                    'sdpMid': String(e.candidate.sdpMid),
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                }
                var data = {
                    "candidate": newCandidate,
                    "producer_id": producers[i].id,
                }
                console.log(data);
                socket_ProducerCandidateToClient(producers[i].socket_id, data)
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



// -------------------------------------------------------------------------
/**
 * @param  id producer id
 * @return producer index
 */
async function producerUpdateSocket(id, socket_id) {
    try {
        console.log("update socket")
        let i = await producerIndex(id)
        if (i >= 0) {
            let socket = await io.sockets.sockets.get(socket_id)
            if (socket != null || socket != undefined) {
                console.log("producer sockets updated")
                producers[i].socket_id = socket.id;
            }
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id producer id
 * @return producer index
 */
async function producerIndex(id) {
    // return producers.findIndex((e) => e.id == id)
    var index = -1;
    for (let i = 0; i < producers.length; i++) {
        if (producers[i].id == id) {
            index = i;
            break;
        }
    }
    return index;
}

/**
 * @param  id producer id
 * @return void
 */
async function removeProducer(id) {
    try {
        let i = await producerIndex(id)
        if (i >= 0) {
            console.log("remove producer")
            await removeProducerFromRoom(producers[i].id, producers[i].room_id)
            await removeConsumerByProducerId(id)
            producers.splice(i, 1)
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
        let room_index = await roomIndex(room_id)
        if (room_index >= 0) {
            for (var x = 0; x < rooms[room_index].producer_ids.length; x++) {
                if (rooms[room_index].producer_ids[x] === producer_id) {
                    rooms[room_index].producer_ids.splice(x, 1);
                    x--;
                }
            }
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}







// ================================================================================================ 
// ================================================================================================ consumer functions
// ================================================================================================ 


/**
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  consumer index
 */
async function createConsumer(socket_id, producer_index, sdp, use_sdp_transform = false) {
    var id = uuidv4()

    var consumer = new Consumer(
        id,
        producers[producer_index].id,
        socket_id,
        new webrtc.RTCPeerConnection(configurationPeerConnection, offerSdpConstraints))
    await consumers.push(consumer)
    var consumer_index = await consumerIndex(id);
    if (consumer_index >= 0) {
        // --------------------------------- process offer answer sdp
        await consumerWebRTCProcess(consumer_index, sdp, producer_index, use_sdp_transform);
        consumerWebRTCCallback(consumer_index, producer_index);
    }
    return consumer_index;
}

/**
 * @param  i consumer index
 * @param  sdp sdp offer from client in json
 * @return sdp answer
 */
async function consumerWebRTCProcess(consumer_index, sdp, producer_index, use_sdp_transform = false) {
    try {

        console.log("sdp3 ------------------------");
        console.log(sdp)
        var newsdp
        if (use_sdp_transform) {
            newsdp = await sdpFromJsonString(sdp)
        } else {
            newsdp = sdp
        }
        producers[producer_index].stream.getTracks().forEach(track => consumers[consumer_index].peer.addTrack(track, producers[producer_index].stream));
        const desc = new webrtc.RTCSessionDescription(newsdp);
        await consumers[consumer_index].peer.setRemoteDescription(desc);
        const answer = await consumers[consumer_index].peer.createAnswer({ 'offerToReceiveVideo': 1 });
        await consumers[consumer_index].peer.setLocalDescription(answer);
        console.log("starting track")

    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

// ======================================================== consumer WebRTC callback
/**
 * @param  consumer_index consumer index
 * @param  producer_id producer id
 * @return void
 */
async function consumerWebRTCCallback(consumer_index, producer_index) {

    // --------------------------------- media stream
    // consumerOnMediaStream(consumer_index, producer_index)
    // --------------------------------- detect disconnected
    consumerOnIceConnectionStateChange(consumer_index)
        // --------------------------------- send ice candidate to client
    consumerOnIceCandidate(consumer_index, producer_index)
}

// /**
//  * @param  consumer_index consumer index
//  * @param  producer_index producer index
//  * @return void
//  */
// async function consumerOnMediaStream(consumer_index, producer_index) {
//     try {
//         producers[producer_index].stream.getTracks().forEach(track =>
//             consumers[consumer_index].peer.addTrack(track, producers[producer_index].stream)
//         );
//     } catch (e) {
//         console.log(e);
//         console.log("\x1b[31m", "ERROR................", "\x1b[0m");
//     }
// }


/**
 * @param  consumer_index consumer index
 * @return void
 */
async function consumerOnIceConnectionStateChange(consumer_index) {
    consumers[consumer_index].peer.oniceconnectionstatechange = (e) => {
        try {
            if (consumers[consumer_index]) {
                const connectionStatus2 = consumers[consumer_index].peer.iceConnectionState;
                if (["disconnected", "failed", "closed"].includes(connectionStatus2)) {
                    console.log("\x1b[31m", "consumers: " + consumers[consumer_index].id + " - " + connectionStatus2, "\x1b[0m")
                    removeConsumer(consumers[consumer_index].id)
                }
                if (["connected"].includes(connectionStatus2)) {
                    console.log("\x1b[34m", "consumers: " + consumers[consumer_index].id + " - " + connectionStatus2, "\x1b[0m")
                }
            }
        } catch (e) {
            console.log(e);
            console.log("\x1b[31m", "ERROR................", "\x1b[0m");
        }
    }
}

/**
 * @param  consumer_index consumer index
 * @param  producer_id producer id
 * @return void
 */
async function consumerOnIceCandidate(consumer_index, producer_index) {
    try {
        consumers[consumer_index].peer.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            try {
                console.log("ice candidate send to consumer: " + consumers[consumer_index].socket_id)
                var newCandidate = {
                    'candidate': String(e.candidate.candidate),
                    'sdpMid': String(e.candidate.sdpMid),
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                }
                var data = {
                    "candidate": newCandidate,
                    "producer_id": producers[producer_index].id,
                    "consumer_id": consumers[consumer_index].id
                }
                console.log(data);
                socket_ConsumerCandidateToClient(consumers[consumer_index].socket_id, data)
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



// -------------------------------------------------------------------------
/**
 * @param  id consumer id
 * @return consumer index
 */
async function consumerIndex(id) {
    // return consumers.findIndex((e) => e.id == id)
    var index = -1;
    for (let i = 0; i < consumers.length; i++) {
        if (consumers[i].id == id) {
            index = i;
            break;
        }
    }
    return index;
}

/**
 * @param  id consumer id
 * @return void
 */
async function removeConsumer(id) {
    try {
        var i = await consumerIndex(id)
        if (i >= 0) {
            console.log("remove consumer")
            consumers.splice(i, 1)
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
async function removeConsumerByProducerId(id) {
    try {
        for (var x = 0; x < consumers.length; x++) {
            if (consumers[x].producer_id === id) {
                consumers.splice(x, 1);
                x--;
            }
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}