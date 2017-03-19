function Room(code){
	this.code = code;
	this.master = -1;
	this.people = [];
	this.currentVideo = "";
	this.videoState = "";
	this.videoTime = 0;
}

module.exports = Room;