# zomie

Media server for <a href="https://github.com/Mamena2020/zomie-app"> zomie app</a>
Server running in nodejs. each client will have 2 active peer 1 for broadcasting &
1 for consumer for all user in the room. this server using star topology & SFU(Selective Forwarding Unit) method for routing.

#run
  - dev
    - npm run dev
    - nodemon server
  - prod
    - npm run start
    - node server   


socket info
  - server:   
  - flutter:  


#cors allow 
  - issues
    - https://stackoverflow.com/questions/43150051/how-to-enable-cors-nodejs-with-express  

#web RTC
  - Articles
    - https://bloggeek.me/webrtc-rtcpeerconnection-one-per-stream/
  - Videos - Topologies
    - https://www.youtube.com/watch?v=N1yj6gI2CTE&ab_channel=EngineeringSemester
    - https://www.youtube.com/watch?v=d2N0d6CKrbk&ab_channel=TsahiLevent-Levi
  - issues
    - https://stackoverflow.com/questions/53251527/webrtc-video-is-not-displaying


# Note

- socket io
  - version info match [1]
    - server(node js): "socket.io": "^2.4.1"
    - client(flutter):  socket_io_client: ^1.0.1 | ^1.0.2
  - version info match [2]
    - server(node js): "socket.io": "^4.5.3"
    - client(flutter):  socket_io_client: ^2.0.0

  - Code for working in flutter.
      ```
          import 'package:socket_io_client/socket_io_client.dart' as IO;
          IO.Socket socket = IO.io(host,IO.OptionBuilder()
            .setTransports(['websocket']) // for Flutter or Dart VM
            .setExtraHeaders({'foo': 'bar'}) // optional
            .build());
      ```    

- WebRTC
  - consumer listen to producer media have to before set offer local sdp 
  - https://www.rtcmulticonnection.org/docs/removeStream/
- js code tips
  - file management
    - https://stackoverflow.com/questions/57108371/exporting-multiple-functions-with-arguments 
  - routing  controller
    - https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/routes 


- color console.log()
  ```
    Reset = "\x1b[0m"
    Bright = "\x1b[1m"
    Dim = "\x1b[2m"
    Underscore = "\x1b[4m"
    Blink = "\x1b[5m"
    Reverse = "\x1b[7m"
    Hidden = "\x1b[8m"

    FgBlack = "\x1b[30m"
    FgRed = "\x1b[31m"
    FgGreen = "\x1b[32m"
    FgYellow = "\x1b[33m"
    FgBlue = "\x1b[34m"
    FgMagenta = "\x1b[35m"
    FgCyan = "\x1b[36m"
    FgWhite = "\x1b[37m"

    BgBlack = "\x1b[40m"
    BgRed = "\x1b[41m"
    BgGreen = "\x1b[42m"
    BgYellow = "\x1b[43m"
    BgBlue = "\x1b[44m"
    BgMagenta = "\x1b[45m"
    BgCyan = "\x1b[46m"
    BgWhite = "\x1b[47m" 

  ```
    

  
