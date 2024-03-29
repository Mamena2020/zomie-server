const { rooms, producers } = require('../data')
const utils = require('../utils')
const roomService = require('../services/roomService')
const producerService = require('../services/producerService')
const socketfunction = require("../socket/socketfunction")


/**
 * Get room by room id
 * @param {*} req => room id : 
 * string id (required)
 * @return json
 */
async function get(req, res) {
    var id = req.query.id;
    return roomService.get(id, res)
}

/**
 * check room validation 
 * 
 * @param {*} body => map {
 * 
 * string room_id (Required),
 * 
 * string password (optional)
 * 
 * }
 * @return json
 */
async function check({ body }, res) {
    var id = body.room_id
    var password = body.password
    return roomService.check(id, password, res)
}


/**
 * create room
 * @param {Map} body=> map {
 * 
 * String password (optional),
 * 
 * int life_time  (optional)
 * 
 * } 
 * @return json
 */
async function create({ body }, res) {
    try {

        var password = null
        if (body.password != undefined && body.password != null) {
            password = body.password
        }
        var video_bitrate = 90
        if (body.video_bitrate != undefined && body.video_bitrate != null) {
            video_bitrate = body.video_bitrate
        }
        var screen_bitrate = 250
        if (body.screen_bitrate != undefined && body.screen_bitrate != null) {
            screen_bitrate = body.screen_bitrate
        }

        var life_time = 1
        if (body.life_time != undefined || body.life_time != null) {
            life_time = body.life_time
        }

        var id = await roomService.create(password, life_time, video_bitrate, screen_bitrate)

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

/**
 * Join room 
 * @param {Map} body {
 * 
 * string producer_id (required)
 * 
 * string user_name (required)
 * 
 * bool has_video (required)
 * 
 * bool has_audio (required)
 * 
 * json sdp (required)
 * 
 * string room_id (required)
 * 
 * bool use_sdp_transform (optional)
 * 
 * string platform (required)
 * 
 * } 
 * @return json 
 */
async function join({ body }, res) {
    var data = {};
    var statusCode = 200
    try {
        
        console.log("join room")
        console.log("id: " + body.producer_id)
        console.log("user id: " + body.user_id)
        console.log("name: " + body.user_name)
        console.log("has video: " + body.has_video)
        console.log("has audio: " + body.has_audio)
        console.log("type: " + body.type)
        console.log("room id: " + body.room_id)
        console.log("platform: " + body.platform)


        if (!rooms[body.room_id]) {
            statusCode = 404;
            data = {
                "message": "room not found",
                "data": {}
            }
            return res.status(statusCode).json(data)
        }
        // var use_sdp_transform = body.use_sdp_transform;
        // if ( use_sdp_transform == null || use_sdp_transform== undefined) {
        //     use_sdp_transform = false
        // }

        var socket = await socketfunction.getSocketById(body.socket_id)

        if (!socket) {
            statusCode = 403;
            data = {
                "message": "failed to join",
                "data": {}
            }
            return res.status(statusCode).json(data)
        }

        var producer_id = await producerService.create(
            socket.id,
            body.room_id,
            body.producer_id,
            body.user_id,
            body.user_name,
            body.has_video,
            body.has_audio,
            body.type,
            body.sdp,
            body.platform
        )
        let room_id = await producerService.addToRoom(body.room_id, producer_id)
        if (!producers[producer_id] || !room_id) {
            statusCode = 427
            data = {
                "message": "failed join room",
                "data": {}
            }
            return res.status(statusCode).json(data)
        }
        // --------------------------------- send back sdp to client

        var sdp = await producers[producer_id].peer.localDescription
        var newsdp = await utils.sdpToJsonString(sdp)

        statusCode = 200
        data = {
            "message": "success join",
            "data": {
                sdp: newsdp,
                room_id: room_id,
                room_password: rooms[room_id].password ?? null,
                producer_id: producers[producer_id].id,
                user_id: producers[producer_id].user_id,
                user_name: producers[producer_id].name,
                producers: producerService.getProducersFromRoom(room_id)
            }
        }
    } catch (e) {
        statusCode = 409
        data = {
            "message": "conflic",
            "data": {}
        }
        console.log(e)
    }
    return res.status(statusCode).json(data)

}
/** Get all active room
 * @return json
 */
async function gets(req, res) {
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
            "user_id": producers[p].user_id,
            "name": producers[p].name,
            "socket_id": producers[p].socket_id,
            "stream_id": producers[p].stream != null ? producers[p].stream.id : '-',
            "has_video": producers[p].has_video,
            "has_audio": producers[p].has_audio,
            "platform": producers[p].platform,
            "type": producers[p].type,
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
    get,
}