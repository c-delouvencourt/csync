var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var assert = require('assert');
var http = require("http").Server(app);
var io = require('socket.io')(http);

// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;

// Custom object
var Room = require('./libs/room.js');

var rooms = [];
var userId = 0;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));

app.set('view engine', 'ejs');

app.get('/', function(req, res){
	res.render('home');
});

// Listen to port 8080
http.listen(port, function(){
	console.log("listening on " + port);
});

app.get(/^.room-\w\w\w\w\w$/, function(req, res){
	code = req.originalUrl.substring(6, 11);
	for(var i = 0; i < rooms.length; i++){
		if(rooms[i].code === code){
			res.render("room", {title: "Sale " + code});
			return;
		}
	}
	res.status(404).send("Cette salle n'existe pas");
});

app.post('/makeRoom', function(req, rs){
	var newCode = generateRoomCode();

	rooms.push(new Room(newCode));
	rs.redirect('/room-' + newCode)
});

app.post('/joinRoom', function(req, rs){
	rs.redirect('/room-' + req.body.joinRoomName);
});

function generateRoomCode(){
	var code = "";
	var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

	for(var i = 0; i < 5; i++){
		code += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return code;
}


io.on("connection", function(socket){
	var user;
	var currentRoom;
	var roomIndex;

	var getRoomCode = socket.handshake.query.roomCode;

	for(var i = 0; i < rooms.length; i++){
		if(rooms[i].code === getRoomCode){
			currentRoom = rooms[i];
			roomIndex = i;
			break;
		}
	}
	socket.join(getRoomCode);

	socket.on("new-user", function(data){
		user = {id : userId, name : data.user};
		userId++;

		if(currentRoom.master === -1){
			currentRoom.master = user.id;
			user.name = "★ " + user.name
		}

		currentRoom.people.push(user);

		io.to(data.code).emit("update-users", currentRoom.people);
		io.to(data.code).emit("connection-message", user.name);
	});

	socket.on("chat-submit", function(data){
		var chatUsername = data.user;

		if(currentRoom.master === user.id){
			chatUsername = "★ " + data.user;
		}

		io.to(data.code).emit("update-messages", {user: chatUsername, msg: data.msg});
	});

	socket.on("disconnect", function(){
		if(user != null){
			for(var i = 0; i < currentRoom.people.length; i++){
				if(user.id === currentRoom.people[i].id){
					var temp = currentRoom.people[i];
					currentRoom.people.splice(i, 1);

					if(currentRoom.people[0] != null){
						if(currentRoom.people[0].id != currentRoom.master){
							currentRoom.master = currentRoom.people[0].id;
							currentRoom.people[0].name = "★ " + currentRoom.people[0].name;
						}
					}
					else{
						currentRoom.master = -1;
					}

					io.to(currentRoom.code).emit("update-users", currentRoom.people);
					io.to(currentRoom.code).emit("disconnection-message", temp.name);
					break;
				}
			}
		}

		if(currentRoom != null){

			setTimeout(function(){
				if(currentRoom.people.length===0){
					rooms.splice(roomIndex, 1);
					console.log("Room deleted");
				}
			}, 10000);
		}
	});

	socket.on("pause-player", function(){
		if(currentRoom != undefined){
			currentRoom.videoState = 2;
			io.to(currentRoom.code).emit("set-player-state-paused");
		}
	});

	socket.on("play-player", function(){
		if(currentRoom != undefined){
			currentRoom.videoState = 1;
			io.to(currentRoom.code).emit("set-player-state-play");
		}
	});

	socket.on("change-video", function(id){
		if(currentRoom != undefined){
			currentRoom.currentVideo = id;
			io.to(currentRoom.code).emit("update-video", {videoId : id, currentTime : 0, state : 1});
		}
	});

	socket.on("set-video", function(){
		if(currentRoom != undefined)
			socket.emit("update-video", {videoId : currentRoom.currentVideo, currentTime : currentRoom.videoTime, state : currentRoom.videoState});
	})

	socket.on("seek-video", function(time){
		if(currentRoom != undefined)
			io.to(currentRoom.code).emit("update-currentTime", time);
	});

    socket.on("update-room-time", function(time){
    	if(currentRoom != undefined){
    		currentRoom.videoTime = time;
    	}
    });
});
