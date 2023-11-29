let roomListDiv = document.getElementById('room-list');
let messagesDiv = document.getElementById('messages');
let newMessageForm = document.getElementById('new-message');
let newRoomForm = document.getElementById('new-room');
let statusDiv = document.getElementById('status');

let roomTemplate = document.getElementById('room');
let messageTemplate = document.getElementById('message');

let messageField = newMessageForm.querySelector("#message");
let usernameField = document.getElementById('username-text');//querySelector("#username");
let roomNameField = newRoomForm.querySelector("#name");

let mainRoom = "Lounge";

var STATE = {
  room: mainRoom,
  rooms: {},
  connected: false,
}

// Generate a color from a "hash" of a string. Thanks, internet.
function hashColor(str) {
  let hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  return `hsl(${hash % 360}, 100%, 70%)`;
}

// Add a new room `name` and change to it. Returns `true` if the room didn't
// already exist and false otherwise.
function addRoom(name) {
  if (STATE[name]) {
    changeRoom(name);
    return false;
  }

  var node = roomTemplate.content.cloneNode(true);
  var room = node.querySelector(".room");
  room.addEventListener("click", () => changeRoom(name));
  room.textContent = name;
  room.dataset.name = name;
  roomListDiv.appendChild(node);

  STATE[name] = [];
  changeRoom(name);
  subscribedb("/getdb");
  return true;
}

// Change the current room to `name`, restoring its messages.
function changeRoom(name) {
  if (STATE.room == name) return;

  var newRoom = roomListDiv.querySelector(`.room[data-name='${name}']`);
  var oldRoom = roomListDiv.querySelector(`.room[data-name='${STATE.room}']`);
  if (!newRoom || !oldRoom) return;

  STATE.room = name;
  oldRoom.classList.remove("active");
  newRoom.classList.add("active");

  messagesDiv.querySelectorAll(".message").forEach((msg) => {
    messagesDiv.removeChild(msg)
  });

  STATE[name].forEach((data) => addMessage(name, data.username, data.message))
}

// Add `message` from `username` to `room`. If `push`, then actually store the
// message. If the current room is `room`, render the message.
function addMessage(room, username, message, push = false) {
  if (push) {
    STATE[room].push({ username, message })
  }

  if (STATE.room == room) {
    var node = messageTemplate.content.cloneNode(true);
    node.querySelector(".message .username").textContent = username;
    node.querySelector(".message .username").style.color = hashColor(username);
    node.querySelector(".message .text").innerHTML  = message;
    messagesDiv.appendChild(node);
  }
}

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri) {
  var retryTime = 1;

  function connect(uri) {
    const events = new EventSource(uri);

    events.addEventListener("message", (ev) => {
      console.log("raw data", JSON.stringify(ev.data));
      console.log("decoded data", JSON.stringify(JSON.parse(ev.data)));
      const msg = JSON.parse(ev.data);
      if (!"message" in msg || !"room" in msg || !"username" in msg) return;
      addMessage(msg.room, msg.username, msg.message, true);
    });

    events.addEventListener("open", () => {
      setConnectedStatus(true);
      console.log(`connected to event stream at ${uri}`);
      retryTime = 1;
    });

    events.addEventListener("error", () => {
      setConnectedStatus(false);
      events.close();

      let timeout = retryTime;
      retryTime = Math.min(64, retryTime * 2);
      console.log(`connection lost. attempting to reconnect in ${timeout}s`);
      setTimeout(() => connect(uri), (() => timeout * 1000)());
    });
  }

  connect(uri);
}



function subscribedb(uri) {
  var retryTime = 1;

  function connect(uri) {
    const events = new EventSource(uri);

    events.addEventListener("message", (ev) => {
      console.log("raw data", JSON.stringify(ev.data));
      console.log("decoded data", JSON.stringify(JSON.parse(ev.data)));
      const msg = JSON.parse(ev.data);
      if (msg === "") {
      //if (!"message" in msg || !"room" in msg || !"username" in msg) {
        events.close(); 
        return;
      }
      if(STATE.room == msg.room){
        addMessage(msg.room, msg.username, msg.message, true);
        //addMessage(msg.room, msg.username, "hmmmm", true);
      }
      
      //events.close();
      
    });
/*
    events.addEventListener("open", () => {
      setConnectedStatus(true);
      console.log(`connected to event stream at ${uri}`);
      retryTime = 1;
    });

    events.addEventListener("error", () => {
      setConnectedStatus(false);
      events.close();

      let timeout = retryTime;
      retryTime = Math.min(64, retryTime * 2);
      console.log(`connection lost. attempting to reconnect in ${timeout}s`);
      setTimeout(() => connect(uri), (() => timeout * 1000)());
    });*/
  }

  connect(uri);
}


// Set the connection status: `true` for connected, `false` for disconnected.
function setConnectedStatus(status) {
  STATE.connected = status;
  statusDiv.className = (status) ? "connected" : "reconnecting";
}



function generateRandomNumberString(length) {
    let result = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charactersLength);
      result += characters.charAt(randomIndex);
    }
  
    return result;
  }




// Let's go! Initialize the world.
function init() {
  // Initialize some rooms.
  addRoom(mainRoom);
  changeRoom(mainRoom);
  addMessage(mainRoom, "plant_bot", `<span style = "color:green">v0.0.1</span><br> Running on rust 🦀 using rocket and sqlite. <br>
   All messages will eventually be deleted (can't afford to migrate them to new schema).`, true);
  addMessage(mainRoom, "plant_bot", `Everyone can see the Lounge 🗿👍!`, true);
  const identifier = generateRandomNumberString(4);


  document.addEventListener("DOMContentLoaded", function () {
    const popup = document.getElementById("popup");
    const chatRoom = document.getElementById("chat-room");
    const usernameInput = document.getElementById("username-text");
    const okButton = document.getElementById("ok-button");
  
    // Show the pop-up
    popup.style.display = "flex";


     // Handle OK button click
    function handleOkButtonClick() {
      const username = usernameInput.value;
      if (username.trim() !== "") {
        popup.style.display = "none";
        //chatRoom.style.visibility = "visible";
        // You can use the username in your chat functionality
      }
    }

    okButton.addEventListener("click", handleOkButtonClick);

    // Handle Enter key press in username input
    usernameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevent form submission
        handleOkButtonClick();
      }
    });


  /*
    // Handle OK button click
    okButton.addEventListener("click", function () {
      const username = usernameInput.value;
      if (username.trim() !== "") {
        popup.style.display = "none";
        // You can use the username in your chat functionality
      }
    });*/
  });




  // Set up the form handler.
  newMessageForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const room = STATE.room;
    const message = messageField.value;

    
    if(!usernameField.value){
        username =  "guest";//+"_"+identifier;
    }
    else{
        username = usernameField.value;//+"_"+identifier;
    }
    if (!message || !username) return;

    if (STATE.connected) {
      fetch("/message", {
        method: "POST",
        body: new URLSearchParams({ room, username, message }),
      }).then((response) => {
        if (response.ok) messageField.value = "";
      });
    }
  })

  // Set up the new room handler.
  newRoomForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const room = roomNameField.value;
    if (!room) return;

    roomNameField.value = "";
    if (!addRoom(room)) return;

    addMessage(room, "plant_bot", `Share your room name to start chatting with others ◝(ᵔᵕᵔ)◜!`, true);
  })

  // Subscribe to server-sent events.
  console.log("sdfsd");
  //subscribedb("/getdb");
  console.log("sdfds");
  subscribe("/events");
}

init();