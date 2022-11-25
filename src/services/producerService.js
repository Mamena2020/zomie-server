const webrtc = require("wrtc")
const config = require('../config/config')
const { v4: uuidv4 } = require('uuid')
const utils = require("../utils")
const {rooms,producers}  = require('../data')
const socketfunction = require('../socket/socketfunction')



class Producer {
    constructor(
        socket_id = null,
        room_id = null,
        id = null,
        user_id=null,
        name = null,
        has_video = true,
        has_audio = true,
        type = null,
        peer = new webrtc.RTCPeerConnection(),
        peerConsumer = new webrtc.RTCPeerConnection(),
        stream =  webrtc.MediaStream(),
        platform = null,
    ) {
        this.socket_id = socket_id
        this.room_id = room_id
        this.id = id
        this.user_id = user_id
        this.name = name
        this.has_video = has_video
        this.has_audio = has_audio
        this.type = type
        this.peer = peer
        this.peerConsumer = peerConsumer
        this.stream = stream
        this.platform = platform
    }
}



/**
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  producer index
 */
 async function create(
    socket_id,
    room_id,
    producer_id,
    user_id,
    user_name,
    has_video = true,
    has_audio = true,
    type,
    sdp,
    platform,
    use_sdp_transform = false) {

    if (producer_id == null || producer_id == undefined || producer_id == "") {
        producer_id = uuidv4()
    }
    if (user_name == undefined || user_name == null) {
        user_name = "user-" + String(Date.now())
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
        user_id,
        user_name,
        has_video,
        has_audio,
        type, // user | screen
        new webrtc.RTCPeerConnection(config.configurationPeerConnection, config.offerSdpConstraints),
        new webrtc.RTCPeerConnection(config.configurationPeerConnection, config.offerSdpConstraints),
        new webrtc.MediaStream(),
        platform
    )

    producers[producer_id] = producer
    producers[producer_id].peer.addTransceiver("video", { direction: "sendrecv" })
    producers[producer_id].peer.addTransceiver("audio", { direction: "sendrecv" })


    producers[producer_id].peer.onnegotiationneeded = (e) => {
        console.log("\x1b[34m", "producers: onnegotiationneeded " + producers[producer_id].name, "\x1b[0m")
    }



    setMediaStream(producer_id)
        // --------------------------------- process offer answer sdp
   
    await sdpProcess(producer_id, sdp,room_id,  use_sdp_transform)
    onIceConnectionStateChange(producer_id)
        // --------------------------------- send ice candidate to client
    onIceCandidate(producer_id)
    return producer_id;
}


// ======================================================== producer WebRTC


/**
 * @param  id producer id
 * @return void
 */
async function setMediaStream(id) {
    try {
        // producers[id].peer.ontrack = function(e) {
        //     if(producers[id].stream==null)
        //     {
        //         console.log("on Track when join")
        //         producers[id].stream = e.streams[0];
        //     }
        // }
        producers[id].peer.ontrack = (e)=> 
                producers[id].stream = e.streams[0];
        
        
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

async function addTrackFromOtherUsers(id,room_id)
{
    try
    {   
        for (let p in rooms[room_id].producers) {
            if (producers[p] != null && producers[p].stream!=null && p!=id) {
                for(var tr of producers[p].stream.getTracks())
                {
                    producers[id].peer.addTrack(tr, producers[p].stream)
                }
            }
        }
    }catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * @param  id producer id
 * @param  sdp sdp offer from client in json
 * @return sdp answer
 */
async function sdpProcess(producer_id, sdp,room_id, use_sdp_transform) {
    try {
        var newsdp
        console.log("use_sdp_transform");
        console.log(use_sdp_transform);
        if (use_sdp_transform) {
            newsdp = await utils.sdpFromJsonString(sdp)
        } else {
            newsdp = sdp
        }
        const desc = new webrtc.RTCSessionDescription(newsdp);
        await producers[producer_id].peer.setRemoteDescription(desc);    

        await addTrackFromOtherUsers(producer_id,room_id)

        const answer = await producers[producer_id].peer.createAnswer({ 'offerToReceiveVideo': 1,'offerToReceiveAudio':1});
        // const answer = await producers[producer_id].peer.createAnswer();
        await producers[producer_id].peer.setLocalDescription(answer);
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}




/**
 * @param  id producer id
 * @return void
 */
async function onIceConnectionStateChange(id) {
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
async function onIceCandidate(id) {
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
                        "user_id": producers[id].user_id,
                        "room_id": producers[id].room_id,
                        "type": producers[id].type,

                    }
                    // console.log(data);
                    socketfunction.producerCandidateToClient(producers[id].socket_id, data)
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
async function addCandidate(producer_id, candidate) {

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
async function notify(room_id, producer_id, type, message = '', ) {
    try {
        console.log("starting notify " + type)
        
        var _producers = []
        if(type == "join")
        {
            _producers = await getProducersFromRoomToArray(room_id)
        }
        if(type == "leave")
        {
            _producers = await getProducersFromRoomToArray(room_id,producer_id)
        }


        var data = {
            "room_id": room_id,
            "producer": {
                "id": producer_id,
                "user_id": producers[producer_id].user_id,
                "name": producers[producer_id].name,
                "stream_id": producers[producer_id].stream!=null?producers[producer_id].stream.id:'',
                "has_video": producers[producer_id].has_video,
                "has_audio": producers[producer_id].has_audio,
            },
            "producers": _producers,
            "type": type,
            "message": message
        }
        console.log(data)

        for (let p in rooms[room_id].producers) {
            if (producers[p] != null) {
                // if (type == "join" || type == "leave") {
                // if (type == "leave") {
                //     // send to all in the room
                //     socketfunction.producerEventNotify(producers[p].socket_id, data)
                // } else 
                {
                    // except self
                    if (p != producer_id) {
                        socketfunction.producerEventNotify(producers[p].socket_id, data)
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
async function updateData(data) {
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
        let socket =  await socketfunction.getSocketById(data["socket_id"])
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
            notify(room.id, producer.id, "update");
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
async function remove(id) {
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


async function removeBySocketId(socket_id) {
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
async function removeWhenDisconectedFromSocket(socket_id) {
    setTimeout(async() => {
        await removeBySocketId(socket_id)
    }, 5000); // 5 second after disconected will remove producer by socket id
}



async function endCall(room_id, producer_id) {
    if (rooms[room_id] != null && producers[producer_id] != null) {
        await notify(room_id, producer_id, "leave")
        await remove(producer_id)
    }
}


/**
 * @param  room_id room id
 * @param  producer_id producer id
 * @return room id
 */
 async function addToRoom(room_id, producer_id) {
    var id = null
    try {
        //xxx store id,name, has_video, has_audio
        if (rooms[room_id] != null) {
            rooms[room_id].producers[producer_id] = {
                id: producers[producer_id].id,
                user_id: producers[producer_id].user_id,
                name: producers[producer_id].name,
                has_video: producers[producer_id].has_video,
                has_audio: producers[producer_id].has_audio,
                platform: producers[producer_id].platform,
                type: producers[producer_id].type,
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
                        "user_id": producers[p].user_id,
                        "name": producers[p].name,
                        "has_video": producers[p].has_video,
                        "has_audio": producers[p].has_audio,
                        "stream_id": producers[p].stream!=null? producers[p].stream.id:'',
                        "platform": producers[p].platform,
                        "type":producers[p].type,
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


/**
 * 
 * @param {String} id producer id 
 */
async function addTrack(producer_id, producer_id_target)
{
    try{

        if(producers[producer_id] == null || producers[producer_id_target] == null && producers[producer_id_target].stream!=null)
        {
            return;
        }
        for(var tr of producers[producer_id_target].stream.getTracks())
        {
            console.log("add track from "+producer_id_target+" to "+producer_id)
            producers[producer_id].peer.addTrack(tr, producers[producer_id_target].stream)
        }
    }catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}
async function addAllTrack(producer_id)
{
    try{

        var room_id= producers[producer_id].room_id    

        if(producers[producer_id] == null && rooms[room_id] == null)
        {
            return;
        }
        await addTrackFromOtherUsers(producer_id,room_id)
    }catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}




async function removeAllTrack(producer_id)
{
    try{
        if(producers[producer_id] == null )
        {
            return;
        }
        console.log("remove all track")

        // var d = new webrtc.RTCPeerConnection();
        // d.getSenders
        var _sender =  producers[producer_id].peer.getSenders();
        for(var tr of _sender)
        {
            producers[producer_id].peer.removeTrack(tr)
        }
    }catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


/**
 * 
 * @param {*} producer_id 
 * @param {*} sdp 
 * @param {*} producer_id_target 
 * @param {*} type => join | leave
 * @returns 
 */
async function renegotiation(producer_id, sdp, producer_id_target,type="join")
{
    try
    {
        console.log("producer id: "+producer_id)
        console.log("producer_id_target: "+producer_id_target)
        console.log("type: "+type)

        
                
      
        var newsdp = await utils.sdpFromJsonString(sdp)
        const desc = new webrtc.RTCSessionDescription(newsdp);
        await producers[producer_id].peer.setRemoteDescription(desc);    


        if(type=="join")
        {
            await addTrack(producer_id,producer_id_target)
        }
        if(type=="leave")
        {
            await removeAllTrack(producer_id)
            await addAllTrack(producer_id,producer_id_target)
        }

        const answer = await producers[producer_id].peer.createAnswer({ 'offerToReceiveVideo': 1,
    'offerToReceiveAudio':1
    })
        // const answer = await producers[producer_id].peer.createAnswer();
        await producers[producer_id].peer.setLocalDescription(answer);
        var localDesc = await producers[producer_id].peer.localDescription
        var localsdp = await utils.sdpToJsonString(localDesc)
        return localsdp;
    }
    catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return null
}


module.exports = {
    create,
    addCandidate,
    addToRoom,
    getProducersFromRoomToArray,
    notify,
    updateData,
    removeWhenDisconectedFromSocket,
    endCall,

    renegotiation
}