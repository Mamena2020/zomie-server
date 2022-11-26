require('dotenv').config();
const host = process.env.HOST
const port = process.env.PORT

const express = require('express')
const cors = require('cors');
const bodyParser = require('body-parser')
const path = require('path');
const app = express()
const server = require('http').Server(app) // running express on http
const io = require('socket.io')(server) // running socket.io on  http

// -----------------------------------------------------------------------------------------------
// middleware policy,  allow all origin to access this server 
app.use(cors())
// make dir public as access to public
// app.use(express.static('public/web'));
app.use(express.static(path.join(__dirname, 'public/web')));
// support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));
//running server
server.listen(port, host, () => {
    console.log("server running : " + host + ":" + port)
})

require('./src/socket/socketevent')(io)
require('./src/socket/socketfunction').init(io)
require('./src/route/route')(app) 


process.on('uncaughtException', function (error) {
    console.log("\x1b[31m", "ERROR uncaughtException................", "\x1b[0m");
    console.log(error.stack);
 });

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

