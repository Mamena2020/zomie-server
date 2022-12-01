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
        this.stream = stream
        this.platform = platform
    }
}



/**
 * @param  socket_id socket client connected
 * @param  sdp sdp answer from client
 * @return  producer id
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
    platform) {

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
        // null , //
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
    onIceCandidate(producer_id)
    
    await sdpProcess(producer_id,sdp)
    onIceConnectionStateChange(producer_id)
    return producer_id;
}


// ======================================================== producer WebRTC


/**
 * @param  producer_id producer id
 * @return void
 */
async function setMediaStream(producer_id) {
    try {
        producers[producer_id].peer.ontrack = (e)=> 
        {     
            if(e.streams.length>0)
            {
                console.log("\x1b[46m", "Add Stream on Track2 for : "+producer_id, "\x1b[0m");
                producers[producer_id].stream = e.streams[0];
            }
        }
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
                   try
                   {
                    producers[id].peer.addTrack(tr, producers[p].stream)
                   }catch(e2)
                   {
                    console.log(e2)
                   }
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
async function sdpProcess(producer_id, sdp) {
    try {
        await handleRemoteSdp(producer_id,sdp)
        const answer = await producers[producer_id].peer.createAnswer({ 'offerToReceiveVideo': 1});
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
                console.log("|oniceconnectionstatechange|:")
                const connectionStatus2 = producers[id].peer.iceConnectionState;
                if (["disconnected", "failed", "closed"].includes(connectionStatus2)) {
                    console.log("\x1b[31m", "producers: " + producers[id].id + " - " + connectionStatus2, "\x1b[0m")
                    removeWhenDisconectedByID(id)
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
                var newCandidate = {
                    'candidate': String(e.candidate.candidate),
                    'sdpMid': String(e.candidate.sdpMid),
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                }
                console.log(newCandidate);
                var data = {
                        "candidate": newCandidate,
                        "producer_id": producers[id].id,
                        "user_id": producers[id].user_id,
                        "room_id": producers[id].room_id,
                        "type": producers[id].type,

                    }
                    socketfunction.candidateToClient(producers[id].socket_id, data)
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
        console.log("from producer id: " + producer_id)    

        if(producers[producer_id]==null)
        return
         

        var _producers = []
        if(type == "join" && producers[producer_id].type =="user")
        {
            addOtherUsersToMe(producer_id)
        }
        if(type == "leave")
        {
            _producers = await getProducersFromRoom(room_id,producer_id)
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
                "type": producers[producer_id].type,
                "platform": producers[producer_id].platform,
            },
            "producers": _producers,
            "type": type,
            "message": message
        }
        console.log(data)
        for (let producer_id_target in rooms[room_id].producers) {
            if (producers[producer_id_target] != null 
                && producer_id_target != producer_id 
                && producers[producer_id_target].type == "user"){
                    // except self
                    if(type=="join" )
                    {
                        addMeToOtherUser(producer_id,producer_id_target)
                    }
                    socketfunction.notify(producers[producer_id_target].socket_id, data)
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
async function removeWhenDisconectedBySocket(socket_id) {
    setTimeout(async() => {
        await removeBySocketId(socket_id)
    }, 6000); // 5 second after disconected will remove producer by socket id
}
// will remove producer after 10 seconds of disconected
async function removeWhenDisconectedByID(id) {
    setTimeout(async() => {
        if(producers[id]!=null)
        {
            await endCall(producers[id].room_id, id) ; 
        }
    }, 6000); // 5 second after disconected will remove producer by socket id
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
    
    try {
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
            return room_id
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return null
}

function getProducersFromRoom(room_id, producer_id_except = null) {
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
    // console.log("getProducersFromRoom")
    // console.log(_producers)
    return _producers;
}



/**
 * 
 * @param {*} from_producer_id 
 * @param {*} to_producer_id 
 * @returns bolean
 */
async function addTrack(from_producer_id, to_producer_id)
{
    try{

        if(producers[to_producer_id] == null || producers[from_producer_id] == null || producers[from_producer_id].stream==null)
        {
            console.log(producers[from_producer_id].stream==null?"Stream Empty":"Stream exist")
            return false;
        }
        for(var tr of producers[from_producer_id].stream.getTracks())
        {
            try
            {
                console.log("add track from "+from_producer_id+" to "+to_producer_id)
                producers[to_producer_id].peer.addTrack(tr, producers[from_producer_id].stream)
            }catch(e){
                console.log(e)
            }
        }
        return true
    }catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return false
}


/**
 * 
 * @param {*} current_producer_id  
 * @param {*} target_producer_id 
 * @returns 
 */
async function addMeToOtherUser(current_producer_id, target_producer_id)
{
    try
    {
            console.log("current_producer_id id: "+current_producer_id)
            console.log("target_producer_id: "+target_producer_id)

            let statusAdd =  await addTrack(current_producer_id,target_producer_id)
            if(!statusAdd)
            {
                
                console.log("\x1b[33m", "no track. to added from: "+current_producer_id+" to: "+ target_producer_id, "\x1b[0m");
                return 
            }  
            
            const offer = await producers[target_producer_id].peer.createOffer({ 'offerToReceiveVideo': 1 });
            await producers[target_producer_id].peer.setLocalDescription(offer);
            var localDesc = await producers[target_producer_id].peer.localDescription
            var localSdp = await utils.sdpToJsonString(localDesc)
            
            var data = {
                "producer_id": target_producer_id,
                "sdp": localSdp,
                "type": producers[target_producer_id].type
            }
            socketfunction.sdpFromServer(producers[target_producer_id].socket_id,data)
    }
    catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
    return null
}

async function addOtherUsersToMe(current_producer_id)
{
    try{
        console.log("add others to me ")
        console.log("current_producer_id : "+ current_producer_id)
       
        await addTrackFromOtherUsers(current_producer_id,producers[current_producer_id].room_id)

        const offer = await producers[current_producer_id].peer.createOffer({ 'offerToReceiveVideo': 1 });
        await producers[current_producer_id].peer.setLocalDescription(offer);
        var localDesc = await producers[current_producer_id].peer.localDescription
        var localSdp = await utils.sdpToJsonString(localDesc)
        
        var data = {
            "producer_id": current_producer_id,
            "sdp": localSdp,
            "type": producers[current_producer_id].type
        }
        
        socketfunction.sdpFromServer(producers[current_producer_id].socket_id,data)
  
    }
    catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

async function handleRemoteSdp(producer_id,sdp)
{
    try
    {
        var newsdp = await utils.sdpFromJsonString(sdp)
        const desc = new webrtc.RTCSessionDescription(newsdp);
        await producers[producer_id].peer.setRemoteDescription(desc); 

        var _producers = await getProducersFromRoom(producers[producer_id].room_id)
        socketfunction.updateConsumers(producers[producer_id].socket_id,
                {
                    "producer_id": producer_id,
                    "producers":_producers
                }
            )    
    } catch(e)
    {
        console.log(e)
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}


module.exports = {
    create,
    addCandidate,
    addToRoom,
    getProducersFromRoom,
    notify,
    updateData,
    removeWhenDisconectedBySocket,
    endCall,
    handleRemoteSdp
}