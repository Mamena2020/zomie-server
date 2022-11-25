
const webrtc = require("wrtc")
const config = require('../config/config')
const {producers,rooms} = require("../data")
const socketFunction = require('../socket/socketfunction')
const utils = require("../utils")

/**
 * flow->
 * after user join room, then will notif to all user via socket.
 * each client will access this update to create consumer for then to stream media
 */
async function update(producer_id) {
    if (producers[producer_id] == null)
        return;
    let room_id = producers[producer_id].room_id
    //-------------------------------------------------------------------- clear old track 
    await removeOldTrack(producer_id)
    //-------------------------------------------------------------------- add new track 
    await addNewTrack(producer_id, room_id)

    consumerOnIceCandidate(producer_id)
    await consmerRenegotiation(producer_id)

   
}

async function removeOldTrack(producer_id)
{
    try {
        if(producers[producer_id].peerConsumer!=null && producers[producer_id].peerConsumer!= undefined)
        {
               // remove track
                var _senders = await producers[producer_id].peerConsumer.getSenders()
                if(_senders!=undefined && _senders!=null )
                {
                    for (let _sender of _senders ) {
                         console.log("remove old track- user id: "+ producers[producer_id].name)
                         producers[producer_id].peerConsumer.removeTrack(_sender);
                    }
                }
        }
        else
        {
            producers[producer_id].peerConsumer = new webrtc.RTCPeerConnection(config.configurationPeerConnection, config.offerSdpConstraints)
        
            producers[producer_id].peerConsumer.addTransceiver("video", { direction: "sendrecv" })
            producers[producer_id].peerConsumer.addTransceiver("audio", { direction: "sendrecv" })
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

async function addNewTrack(producer_id, room_id)
{
    try {
        for (let id in rooms[room_id].producers) {
            if (producers[id] != null && id != producer_id && producers[id].stream!=null) {
                   console.log("\x1b[33m", "ADD CONSUMER TRACK for: "+producer_id, "\x1b[0m");
                   // ---------------------------------------------------------- add new track from other users in the room 
                    for (let track of producers[id].stream.getTracks()) {
                         producers[producer_id].peerConsumer.addTrack(track, producers[id].stream)
                    }     
            }
        }
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

async function consmerRenegotiation(producer_id) {
    try {
        const offer = await producers[producer_id].peerConsumer.createOffer({ 'offerToReceiveVideo': 1 });
        await producers[producer_id].peerConsumer.setLocalDescription(offer);
        var localDesc = await producers[producer_id].peerConsumer.localDescription
        var sdp = await utils.sdpToJsonString(localDesc)
        _data = {
            "producer_id": producer_id,
            "sdp": sdp
        }
        socketFunction.consumerSdpFromServer(producers[producer_id].socket_id, _data)
    } catch (e) {
        console.log(e);
        console.log("\x1b[31m", "ERROR................", "\x1b[0m");
    }
}

/**
 * use when get socket from client after client setup sdp remote
 * @param {*} producer_id 
 * @param {*} sdp 
 * @returns 
 */
async function sdpProcess(producer_id, sdp) {
    
    try
    {
        if (producers[producer_id] == null)
        return;
        
        var newsdp = await utils.sdpFromJsonString(sdp)
        const remoteDesc = new webrtc.RTCSessionDescription(newsdp);
        await producers[producer_id].peerConsumer.setRemoteDescription(remoteDesc);
    
        socketFunction.consumerUpdateClientStream(producers[producer_id].socket_id,{
                "producer_id":producer_id,
                "room_id": producers[producer_id].room_id
            })
            
    }catch(e)
    {
       console.log(e);
       console.log("\x1b[31m", "ERROR................", "\x1b[0m");

   }
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
                socketFunction.consumerCandidateToClient(producers[producer_id].socket_id, data)
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

module.exports = {
    sdpProcess,
    update
}