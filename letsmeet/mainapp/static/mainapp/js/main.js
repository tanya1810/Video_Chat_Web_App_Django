console.log('in main.js')

var mypeer = {};


var usernameinput = document.querySelector('#username')
var btnjoin = document.querySelector('#btn-join')

var username;
var webSocket;


function webSocketOnMessage(event){
    var parsedata = JSON.parse(event.data);
    var peerusername = parsedata['peer'];
    var action = parsedata['action'];

    if(username == peerusername){
        return;
    }

    var receiver_channel_name = parsedata['message']['receiver_channel_name'];

    if(action == 'new-peer'){
        createofferer(peerusername, receiver_channel_name);
        return;
    }
    if(action == 'new-offer'){
        var offer = parsedata['message']['sdp'];
        createanswerer(peerusername, receiver_channel_name);
        return;
    }
    if(action == 'new-answer'){
        var answer = parsedata['message']['sdp'];
        var peer = mypeer[peerusername][0];
        peer.setRemoteDescription(answer);
        return;
    }

}

btnjoin.addEventListener('click', ()=>{
    username = usernameinput.value;

    console.log('username: ', username)

    if(username == ''){
        return;
    }
    usernameinput.value = '';
    usernameinput.disabled = true;
    usernameinput.style.visibility = 'hidden';

    btnjoin.disabled = true;
    btnjoin.style.visibility = 'hidden';
    
    var labelusername = document.querySelector('#label-username')
    labelusername.innerHTML = username

    var loc = window.location;
    var wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://';
    }

    var endpoint = wsStart + loc.host + loc.pathname;

    console.log(endpoint);

    webSocket = new WebSocket(endpoint);

    webSocket.addEventListener('open', ()=>{
        console.log('connection open');

        sendSignal('new-peer', {});
    });
    webSocket.addEventListener('message', webSocketOnMessage);
    webSocket.addEventListener('close', ()=>{
        console.log('connection close');
    });
    webSocket.addEventListener('error', ()=>{
        console.log('connection error');
    });
})


var localstream = new MediaStream();

const constraints = {
    'video': true,
    'audio':true,
}

const localVideo = document.querySelector('#local-video');
const btntoggleaudio = document.querySelector('#btn-toggle-audio');
const btntogglevideo = document.querySelector('#btn-toggle-video');

var usermedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream =>{
        localstream = stream;
        localVideo.srcObject = localstream;
        localVideo.muted = true;

        var audiotracks = stream.getAudioTracks();
        var videotracks = stream.getVideoTracks();

        audiotracks[0].enabled = true;
        videotracks[0].enabled = true;
        btntoggleaudio.addEventListener('click', ()=>{
            audiotracks[0].enabled = !audiotracks[0].enabled;
            if(audiotracks[0].enabled){
                btntoggleaudio.innerHTML = 'Audio Mute';
                return;
            }
            btntoggleaudio.innerHTML = 'Audio Unmute';
        })

        btntogglevideo.addEventListener('click', ()=>{
            videotracks[0].enabled = !videotracks[0].enabled;
            if(videotracks[0].enabled){
                btntogglevideo.innerHTML = 'Video off';
                return;
            }
            btntogglevideo.innerHTML = 'Video on';
        })
    })
    .catch(error => {
        console.log(error);
    })

    

function sendSignal(action, message){
    var jsonstr = JSON.stringify({
        'peer': username,
        'action': action,
        'message':message,
    })
    webSocket.send(jsonstr);
}

function createofferer(peerusername, receiver_channel_name){
    var peer = new RTCPeerConnection(null);
    addlocaltracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', ()=>{
        console.log('open connection');
    })

    var messagelist = document.querySelector('#message-list')
    dc.addEventListener('message', (event)=>{
        var message = event.data;

        var li = document.createElement('li');
        li.appendChild(document.createTextNode(message));
        messagelist.appendChild(li);
    })


    var remotevideo = createVideo(peerusername);
    setontrack(peer, remotevideo);

    mypeer[peerusername] = [peer, dc];
    peer.addEventListener('iceconnectionatachange',  ()=>{
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState ==='disconnected' || iceConnectionState ==='closed'){
            delete mypeer[peerusername];

            if(iceConnectionState!='closed'){
                peer.close();
            }
            removevideo(remotevideo);
        }
    });

    peer.addEventListener('icecandidate', (event)=>{
        if(event.candidate){
            console.log('dfuhuvf');
            return;
        }
        sendSignal('new-offer', {
            'sdp' : peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        })
    })

    peer.createOffer()
        .then(o=> peer.setLocalDescription(o))
        .then(()=>{
            console.log('local descprition updated');
        })
}


function createanswerer(peerusername, receiver_channel_name){
    var peer = new RTCPeerConnection(null);
    addlocaltracks(peer);

    var remotevideo = createVideo(peerusername);
    setontrack(peer, remotevideo);

    peer.addEventListener('datachannel', e=>{
        peer.dc = e.channel;
        peer.dc.addEventListener('open', ()=>{
            console.log('open connection');
        })
        peer.dc.addEventListener('message', (event)=>{
            var message = event.data;
    
            var li = document.createElement('li');
            li.appendChild(document.createTextNode(message));
            messagelist.appendChild(li);
        });
        mypeer[peerusername] = [peer, peer.dc];

    })

    peer.addEventListener('iceconnectionatachange',  ()=>{
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState ==='disconnected' || iceConnectionState ==='closed'){
            delete mypeer[peerusername];

            if(iceConnectionState!='closed'){
                peer.close();
            }
            removevideo(remotevideo);
        }
    });

    peer.addEventListener('icecandidate', (event)=>{
        if(event.candidate){
            console.log('dfuhuvf');
            return;
        }
        sendSignal('new-answer', {
            'sdp' : peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        })
    })

    peer.setRemoteDescription(offer)
        .then(()=>{
            console.log('remote descp set successfully');
            return peer.createAnswer();
        })
        .then(a=>{
            console.log('ans created successfully');
            peer.setLocalDescription(a);
        })

}




function removevideo(video){
    var videowrapper = video.parentNode;
    videowrapper.parentNode.removeChild(videowrapper)
}

function addlocaltracks(peer){
    localstream.getTracks().forEach(track=>{
        peer.addTrack(track, localstream);
    })
}


function createVideo(peerusername){
    var videocontainer = document.querySelector('#video-container');

    var remotevideo = document.createElement('video');
    remotevideo.autoplay = true;
    remotevideo.playsInline = true;

    var videowrapper = document.createElement('div');

    videocontainer.appendChild(videowrapper);
    videowrapper.appendChild(remotevideo);
    return remotevideo;
}

function setontrack(peer, remotevideo){
    var remoteStream = new MediaStream();
    remotevideo.srcObject = remoteStream;
    peer.addEventListener('track', async (event) =>{
        remoteStream.addTrack(event.track, remoteStream);
    });
}