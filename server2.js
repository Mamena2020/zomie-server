// ----------------------------------------- REMINDER-------------------------------------------
/** 
 * for in javacript
 * 1. object 
 *    for(let x in xs)
 * 2. array 
 *    for(let x of xs)
 * length of data 
 * 1. object
 *    Object.keys(rooms[id].producers).length
 *    Object.keys(rooms).length
 * 2. array
 *    rooms.length
 */
// -----------------------------------------------------------------------------------------------
const host = "192.168.1.5"
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

// -----------------------------------------------------------------------------------------------
app.use(cors())
app.use(express.static('public'));
// support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));

server.listen(port, host, () => {
    console.log("server running : " + host + ":" + port)
})

// -----------------------------------------------------------------------------------------------





const _data = {};

app.get("/test-add", async(req, res) => {

    var uuid = uuidv4();

    _data[uuid] = {
        date: "Date  - " + Date.now(),
        children: {}
    }

    res.json({ "data": _data })
})
app.get("/test-add2", async(req, res) => {
    if (_data[req.query.id] != null) {
        console.log("ada exist to add")
        var uuid = uuidv4();
        _data[req.query.id].children[uuid] = " child - " + Date.now()
    }
    res.json({ "data": _data })
})
app.get("/test-delete", async(req, res) => {

    console.log(req.query)

    delete _data[req.query.id];

    res.json({ "data": _data, "body": req.query.id })
})
app.get("/test-show", async(req, res) => {


    let _message = 'found'
    if (_data[req.query.id] == null) {
        _message = 'no found'
    }

    res.json({
        "data": _data,
        "show": _data[req.query.id],
        "length": Object.keys(_data).length,
        "message": _message
    })
})

app.get("/check", async(req, res) => {

    var _rooms = []
    for (let r in rooms) {
        _rooms.push({
            "id": rooms[r].id,
            "password": rooms[r].password,
            "life_time": rooms[r].life_time,
            "producers": rooms[r].producers,
        })
    }

    var _consumers = []
    for (var c in consumers) {
        _consumers.push({
            "id": consumers[c].id,
            "producer_id": consumers[c].producer_id,
            "socket_id": consumers[c].socket_id,
        })
    }
    var _producers = []
    for (var p in producers) {
        _producers.push({
            "id": producers[p].id,
            "name": producers[p].name,
            "socket_id": producers[p].socket_id,
        })
    }


    res.json({
        "status": "list data",
        "rooms": _rooms,
        "producers": _producers,
        "consumers": _consumers,
    })
})


/**
 * on proggress
 *  [1]. when user connect as producer then socket will send its producer id 
 *       to all producer  in the room to add as new consumer for them
 *       socket event: "producer-join-room"
 *       row data:
 *       {
 *         "producer_id": xxx,
 *         "room_id": xxx
 *        }
 *       - step:
 *         looping from producers in rooms. to get socket_id
 *  [2]. when user diconnect, than will socket will send its producer id 
 *       to delete from others producers in the room
 *       socket event: "producer-leave-room".
 *       row data:
 *       {
 *         "producer_id": xxx,
 *         "room_id": xxx
 *        }
 *       - step:
 *         looping from producers in rooms. to get socket_id
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
const producers = {}
const consumers = {}
const rooms = {}
const timeIntervalMonitoringRoomInSec = 1000 * 60




class Producer {
    constructor(
        socket_id = null,
        room_id = null,
        id = null,
        name = null,
        has_video = true,
        has_audio = true,
        peer = new webrtc.RTCPeerConnection(),
        stream = new MediaStream(),
    ) {
        this.socket_id = socket_id
        this.room_id = room_id
        this.id = id
        this.name = name
        this.has_video = has_video
        this.has_audio = has_audio
        this.peer = peer
        this.stream = stream
    }
}

class Consumer {
    constructor(
        id = null,
        owner_producer_id = null,
        producer_id = null,
        socket_id = null,
        peer = new webrtc.RTCPeerConnection(),
    ) {
        this.id = id
        this.owner_producer_id = owner_producer_id
        this.producer_id = producer_id
        this.socket_id = socket_id
        this.peer = peer
    }
}


// this class using for object to store producer to rooms
// class ProducerRoom {
//     constructor(id, name) {
//         this.id = id
//         this.name = name
//     }
// }


class Room {
    constructor(id = null, password = null, life_time, producers = {}, monitor = function() {}) {
        this.id = id
        this.password = password
        this.life_time = life_time
        this.producers = producers
        this.monitor = monitor
    }
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + (minutes * 60 * 1000));
}

// --------------------------------------------------------------------------------------------------------
app.post("/create-room",
    /**
     * @param {Map} body is map of {
  
     *  }
     */
    async function({ body }, res) {
        try {


            var password = body.password
            if (password == undefined || password == null) {
                password = null
            }

            var date = new Date(Date.now())
            var life_time = addMinutes(date, 1); // default 1 minutes
            if (body.life_time != undefined || body.life_time != null) {
                life_time = addMinutes(date, body.life_time)
            }

            var id = await createRoom(password, life_time)
            if (id == null || id == undefined) {
                throw "failed to create room"
            }
            console.log("\x1b[34m", "Room created: " + rooms[id].id, "\x1b[0m")
            console.log("\x1b[34m", "password: " + rooms[id].password, "\x1b[0m")
            console.log("\x1b[34m", "life time: " + rooms[id].life_time, "\x1b[0m")
            console.log(rooms[id])
            var data = {
                room_id: id,
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

app.post("/check-room", async function({ body }, res) {
        var data = {
            "message": "room found"
        }
        var statusCode = 200
        try {
            console.log("check room")
            console.log(body.room_id)

            if (rooms[body.room_id] == null) {
                statusCode = 404
                data = {
                    "message": "room not found"
                }

            } else {
                if (rooms[body.room_id].password != null && rooms[body.room_id].password != body.password) {
                    statusCode = 403
                    data = {
                        "message": "Wrong password"
                    }
                }
            }
            console.log(data)
        } catch (e) {
            statusCode = 404
            console.log(e)
        }
        res.status(statusCode)
        res.json(data)
    })
    // --------------------------------------------------------------------------------------------------------
app.post("/join-room",
    /**
     * @param {Map} body is map of {socket_id,sdp, room_id}
     */
    async function({ body }, res) {
        var data = {};
        var statusCode = 200
        try {
            console.log("join room")
            console.log("id: " + body.producer_id)
            console.log("name: " + body.producer_name)
            console.log("has video: " + body.has_video)
            console.log("has audio: " + body.has_audio)
            console.log("room id: " + body.room_id)

            // console.log(body.socket_id)
            // console.log(body.sdp)
            // console.log(body.use_sdp_transform);

            if (rooms[body.room_id] == null) {
                statusCode = 404;
                data = {
                    "message": "room not found",
                    "data": {}
                }
                throw "room not found"
            }
            var use_sdp_transform = false;
            if (body.use_sdp_transform === true || body.use_sdp_transform == undefined) {
                use_sdp_transform = true
            }

            var socket = await io.sockets.sockets.get(body.socket_id)
            var producer_id = await createProducer(
                socket.id,
                body.room_id,
                body.producer_id,
                body.producer_name,
                body.has_video,
                body.has_audio,
                body.sdp,
                use_sdp_transform
            )
            let room_id = await addProducerToRoom(body.room_id, producer_id)
            if (producers[producer_id] == null || room_id == null) {
                statusCode = 427
                data = {
                    "message": "failed join room",
                    "data": {}
                }
                throw "failed to join room"
            }
            // add producer to room

            // --------------------------------- send back sdp to client
            console.log("sdp local")
            var sdp = await producers[producer_id].peer.localDescription
            var newsdp
            if (use_sdp_transform) {
                newsdp = await sdpToJsonString(sdp)
            } else {
                newsdp = sdp
            }
            statusCode = 200
            data = {
                "message": "success join",
                "data": {
                    sdp: newsdp,
                    room_id: producers[producer_id].room_id,
                    producer_id: producers[producer_id].id,
                    producer_name: producers[producer_id].name,
                    producers: getProducersFromRoomToArray(room_id)
                }
            }

            await sendNotify(
                room_id,
                producer_id,
                "join")

        } catch (e) {
            statusCode = 200
            data = {
                "message": "conflic",
                "data": {}
            }
            console.log(e)
        }
        res.status(statusCode)
        res.json(data)
    })

// --------------------------------------------------------------------------------------------------------

app.post("/consumer",
    /**
     * @param {Map} body is map of {socket_id,sdp, producer_id}
     */
    async function({ body }, res) {
        try {
            console.log("create consumer")
                // console.log(body.socket_id)
                // console.log(body.sdp)
                // console.log(body.producer_id)
                // console.log(body.use_sdp_transform);
            var use_sdp_transform = false;
            if (body.use_sdp_transform === true || body.use_sdp_transform == undefined) {
                use_sdp_transform = true
            }
            // socket
            var socket = await io.sockets.sockets.get(body.socket_id)
            console.log("socket from server: " + socket.id)
                // create consumer
            var id = await createConsumer(socket.id, body.owner_producer_id, body.producer_id, body.sdp, use_sdp_transform)
            if (id == null) {
                throw "failed create consumer- no consumer"
            }
            // --------------------------------- send back sdp to client
            var sdp = await consumers[id].peer.localDescription
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
                consumer_id: id
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
    // ---------------------------------------------------------
    /**
     * @param {Map} data {producer_id, socket_id}
     */
    socket.on("update-data", function(data) {
        updateProducer(data);
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
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function socket_ProducerSendMessage(socket_id, data) {
    console.log("notify update")
    io.to(socket_id).emit("producer-send-message", data)
}
/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function socket_ProducerUpdateData(socket_id, data) {
    console.log("notify update")
    io.to(socket_id).emit("producer-update-data", data)
}
/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */

function socket_ProducerJoinTheRoom(socket_id, data) {
    console.log("notify join")
    io.to(socket_id).emit("producer-join-room", data)
}

/**
 * 
 * @param {String} socket_id socket id of producer target to send 
 * @param {Map} data {room_id,producer_id }
 *   
 */
function socket_ProducerLeaveTheRoom(socket_id, data) {
    console.log("notify leave")
    io.to(socket_id).emit("producer-leave-room", data)
}



/**
 * @param  id room id for search producer_id
 * @return void - send list of producer ids & room_id to all producer in a room,
 */
async function socket_updateInfoRoom(id) {
    try {
        console.log("socket update from ROOM :" + id);
        for (var p in rooms[id].producers) {
            try {

                if (producers[p.id] != null) {
                    console.log("\x1b[35m", "SEND UPDATE TO" + producers[p.id].name, "\x1b[0m");
                    let data = {
                        "room_id": id,
                        "producers": rooms[id].producers
                    }
                    io.to(producers[p.id].socket_id).emit("room-update-from-server", data)
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

    if (rooms[room_id] != null && producers[producer_id] != null) {
        await sendNotify(room_id, producer_id, "leave")
        await removeProducer(producer_id)
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
        // console.log(sdp)


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
 * @return room id
 */
async function createRoom(
    password, life_time
) {
    var id = uuidv4()
    var room = new Room(
        id,
        password,
        life_time, {},
        roomMonitor(id)
    )
    rooms[id] = room
    return id
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

function getProducersFromRoomToArray(room_id) {
    var _producers = [];
    try {
        if (rooms[room_id] != null) {
            for (let p in rooms[room_id].producers) {
                _producers.push(rooms[room_id].producers[p]);
            }
        }
    } catch (e) {
        console.log(e)
    }
    console.log("getProducersFromRoomToArray")
    console.log(_producers)
    return _producers;
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

        delete rooms[id]
        console.log("remove room: " + id)

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
            console.log("total producer in list:" + Object.keys(rooms[id].producers).length)
            if (Object.keys(rooms[id].producers).length <= 0 && Date.now() > rooms[id].life_time) {
                await removeRoom(id)
                    // remove producer by room id
                    // removepro
                clearInterval(monitor)
            } else {
                // socket_updateInfoRoom(id);
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
async function createProducer(
    // socket.id,
    // body.room_id,
    // body.producer_id,
    // body.producer_name,
    // body.has_video,
    // body.has_audio,
    // body.sdp,
    // use_sdp_transform
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
            // remove producer here xxx
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
        new MediaStream(),
    )

    producers[producer_id] = producer
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
        const answer = await producers[id].peer.createAnswer({ 'offerToReceiveVideo': 1 });
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
 * 
 * @param {int}  producer_id producer id 
 * @param {int} room_id room id
 * @param {String} type type of notify- "join" | "leave" | "update" | message
 * @param {String} message message
 */
async function sendNotify(room_id, producer_id, type, message = '') {
    try {
        console.log("starting notify " + type)
        var data = {
            "room_id": room_id,
            "producer": {
                "id": producer_id,
                "name": producers[producer_id].name,
                "has_video": producers[producer_id].has_video,
                "has_audio": producers[producer_id].has_audio,
            },
            "message": message
        }
        console.log(data)
        for (let p in rooms[room_id].producers) {
            if (p != producer_id && producers[p] != null) {
                if (type == "join") {
                    console.log("notify join")
                    socket_ProducerJoinTheRoom(producers[p].socket_id, data)
                }
                if (type == "leave") {
                    console.log("notify leave")
                    socket_ProducerLeaveTheRoom(producers[p].socket_id, data)
                }
                if (type == "update") {
                    console.log("notify update")
                    socket_ProducerUpdateData(producers[p].socket_id, data)
                }
                if (type == "message") {
                    console.log("notify message")
                    socket_ProducerSendMessage(producers[p].socket_id, data)
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
        let socket = await io.sockets.sockets.get(data["socket_id"])
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
            await removeConsumerByProducerId(id)
            producers[id].peer.close()
            producers[id].peer = null
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
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  consumer index
 */
async function createConsumer(socket_id, owner_producer_id, producer_id, sdp, use_sdp_transform = false) {

    if (producers[producer_id] == null)
        return null;

    var id = uuidv4()
    var consumer = new Consumer(
        id,
        owner_producer_id,
        producer_id,
        socket_id,
        new webrtc.RTCPeerConnection(configurationPeerConnection, offerSdpConstraints))
    consumers[id] = consumer

    await consumerWebRTCProcess(id, sdp, producer_id, use_sdp_transform);
    consumerWebRTCCallback(id, producer_id);

    return id;
}

/**
 * @param  id consumer id
 * @param  sdp sdp offer from client in json
 * @return sdp answer
 */
async function consumerWebRTCProcess(id, sdp, producer_id, use_sdp_transform = false) {
    try {

        console.log("sdp3 ------------------------");
        console.log(sdp)
        var newsdp
        if (use_sdp_transform) {
            newsdp = await sdpFromJsonString(sdp)
        } else {
            newsdp = sdp
        }
        console.log("starting track")
        producers[producer_id].stream.getTracks().forEach(track => consumers[id].peer.addTrack(track, producers[producer_id].stream));

        const desc = new webrtc.RTCSessionDescription(newsdp);
        await consumers[id].peer.setRemoteDescription(desc);
        const answer = await consumers[id].peer.createAnswer({ 'offerToReceiveVideo': 1 });
        await consumers[id].peer.setLocalDescription(answer);

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
async function consumerWebRTCCallback(id, producer_id) {

    // --------------------------------- detect disconnected
    consumerOnIceConnectionStateChange(id)
        // --------------------------------- send ice candidate to client
    consumerOnIceCandidate(id, producer_id)
}


/**
 * @param  id consumer id
 * @return void
 */
async function consumerOnIceConnectionStateChange(id) {
    try {
        consumers[id].peer.oniceconnectionstatechange = (e) => {
            try {
                if (consumers[id] != null) {
                    const connectionStatus2 = consumers[id].peer.iceConnectionState;
                    if (["disconnected", "failed", "closed"].includes(connectionStatus2)) {
                        console.log("\x1b[31m", "consumers: " + id + " - " + connectionStatus2, "\x1b[0m")
                        removeConsumer(id)
                    }
                    if (["connected"].includes(connectionStatus2)) {
                        console.log("\x1b[34m", "consumers: " + id + " - " + connectionStatus2, "\x1b[0m")
                    }
                }
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
 * @param  consumer_index consumer index
 * @param  producer_id producer id
 * @return void
 */
async function consumerOnIceCandidate(id, producer_id) {
    try {
        consumers[id].peer.onicecandidate = (e) => {
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
                    "consumer_id": consumers[id].id
                }
                console.log(data);
                socket_ConsumerCandidateToClient(consumers[id].socket_id, data)
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
 * @return void
 */
async function removeConsumer(id) {
    try {
        if (consumers[id] != null) {
            console.log("remove consumer")
            consumers[id].peer.close();
            delete consumers[id]
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
        for (let c in consumers) {
            if (consumers[c].producer_id == id || consumers[c].owner_producer_id == id) {
                consumers[c].peer.close();
                delete consumers[c];
            }
        }

    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}