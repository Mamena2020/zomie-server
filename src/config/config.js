async function configurationPeerConnection(){

      

    // var stun2 = {"urls": "stun:stun.l.google.com:19302"}

   var  iceServers= [
            {"urls": "stun:stun.stunprotocol.org"},
            {
                "urls": "stun:openrelay.metered.ca:80",
                "username": "openrelayproject",
                "credential": "openrelayproject",
            },
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
                "urls": "turn:openrelay.metered.ca:80?transport=tcp",
                "username": "openrelayproject",
                "credential": "openrelayproject",
            },
            {
                "urls": "turn:openrelay.metered.ca:443?transport=tcp",
                "username": "openrelayproject",
                "credential": "openrelayproject",
            },
            {
                "urls": "turns:openrelay.metered.ca:443",
                "username": "openrelayproject",
                "credential": "openrelayproject",
            },
        ] 

    try
    {
            var allowTurnServer = process.env.ALLOW_TURN_SERVER =="true" ||process.env.ALLOW_TURN_SERVER ==true?true:false 
            var turnServerHost = process.env.TURN_SERVER_HOST
            var turnServerUsername = process.env.TURN_SERVER_USERNAME
            var turnServerPassword = process.env.TURN_SERVER_PASSWORD
            if(turnServerHost!="" && turnServerHost.length>3 && allowTurnServer==true)
            {
                var turn =  {
                                'urls': turnServerHost,
                                'username': turnServerUsername,
                                'password': turnServerPassword,
                            }
                iceServers.push(turn)
                console.log("add aditional turn server")
            }   
    }catch(e)
    {
        console.log(e)
    }

    return {
        sdpSemantics: "unified-plan",
        iceServers: iceServers
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