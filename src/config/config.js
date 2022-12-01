// const configurationPeerConnection = {
//     sdpSemantics: "unified-plan",
//     iceServers: [{
//             "urls": "stun:stun.stunprotocol.org"
//         },

//     ]
// }
const configurationPeerConnection = ()=>{

    var allowTurnServer = process.env.ALLOW_TURN_SERVER =="true"?true:false   

    var stun = {"urls": "stun:stun.stunprotocol.org"}
    var stun2 = {"urls": "stun:openrelay.metered.ca:80",}

    var iceServers = [];

    iceServers.push(stun)
    iceServers.push(stun2)

    if(allowTurnServer)
    {
        console.log("using turn server")

        var turnServerHost = process.env.TURN_SERVER_HOST
        var turnServerUsername = process.env.TURN_SERVER_USERNAME
        var turnServerPassword = process.env.TURN_SERVER_PASSWORD

        if(turnServerHost!="" && turnServerHost.length>2)
        {
            var turn =  {
                            'urls': turnServerHost,
                            'username': turnServerUsername,
                            'password': turnServerPassword,
                        }
           iceServers.push(turn)
           console.log("add aditional turn server")
        }

        var turnServersDefault = [
            {
                "urls": "turn:openrelay.metered.ca:80",
                "username": "openrelayproject",
                "credential": "openrelayproject",
              },
              {
                "urls": "turn:openrelay.metered.ca:443",
                "username": "openrelayproject",
                "credential": "openrelayproject",
              },
              {
                "urls": "turn:openrelay.metered.ca:443?transport=tcp",
                "username": "openrelayproject",
                "credential": "openrelayproject",
              }
        ]
        iceServers.push(turnServersDefault)
        
        return {
            sdpSemantics: "unified-plan",
            iceServers: iceServers
        }
    }
    else
    {

        return {
            sdpSemantics: "unified-plan",
            iceServers: iceServers
        }
    }
   
}

const offerSdpConstraints = {
    "mandatory": {
        "OfferToReceiveAudio": true,
        "OfferToReceiveVideo": true,
    },
    "optional": [],
}

module.exports={
    configurationPeerConnection,
    offerSdpConstraints
}