const {rooms,producers}  = require('../data')
const {addMinutes,
    sdpToJsonString,
} = require('../utils')
const { createRoom} =  require('../room')

 const { createProducer,
    sendNotify,
    addProducerToRoom,
    getProducersFromRoomToArray
}   = require('../producer')

const {socket_GetSocketById} = require("../socket/socketfunction")


/**
 * 
 * @param {*} body = > map 
 * @param {*} res 
 */
async function getRoom(req,res)
{   
    var id = req.query.id;

    var data = {
        "id":id,
        "message": "room not found",
        "participants": 0,
        "password":false
    }
    var statusCode = 404
    try {
        console.log("get room : "+id)
        if (rooms[id] != null) {
            statusCode = 200
            data = {
                "id":id,
                "message": "room found",
                "participants": Object.keys(rooms[id].producers).length, 
                "password": rooms[id].password!=null? true: false
            }
        }
        console.log(data)
    } catch (e) {
        console.log(e)
    }
    res.status(statusCode)
    res.json(data)
}

async function check({body},res)
{
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
}

async function create({ body }, res) {
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
}

async function join({ body }, res) {
    var data = {};
    var statusCode = 200
    try {
        console.log("join room")
        console.log("id: " + body.producer_id)
        console.log("name: " + body.producer_name)
        console.log("has video: " + body.has_video)
        console.log("has audio: " + body.has_audio)
        console.log("room id: " + body.room_id)
        console.log("platform: " + body.platform)


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

        // var socket = await io.sockets.sockets.get(body.socket_id)
        var socket = await socket_GetSocketById(body.socket_id)
        var producer_id = await createProducer(
            socket.id,
            body.room_id,
            body.producer_id,
            body.producer_name,
            body.has_video,
            body.has_audio,
            body.sdp,
            body.platform,
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

}

async function gets(req, res)  {
    var _rooms = []
    for (let r in rooms) {
        _rooms.push({
            "id": rooms[r].id,
            "password": rooms[r].password,
            "life_time": rooms[r].life_time,
            "producers": rooms[r].producers,
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
    })
}


module.exports = {
    check,
    create,
    join,
    gets,
    getRoom
}