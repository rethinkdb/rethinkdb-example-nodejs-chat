var socket = io.connect();
socket.emit('iamhere', document.getElementById('name').value);
socket.on('new message', function (data) {
  var id = new Date().getTime();
  document.getElementById('messages').innerHTML += makeChatRow(data);
  var div = document.getElementById('messages');
  setTimeout(div.scrollTop = div.scrollHeight, 1);
});
socket.on('history', function(data) {
  // Store div in variable for the loop.
  var div = document.getElementById('messages');
  for (var i = 0, len = data.length; i < len; i++) {
    div.innerHTML = makeChatRow(data[i]) + div.innerHTML;
  }
  setTimeout(div.scrollTop = div.scrollHeight, 1);
});
socket.on('whoshere', function(data) {
  append = [];
  for (var i in data.users) {
    append.push('<li><a href="/user/' + data.users[i].id + '"><i class="icon-user"></i>' + data.users[i].name + '</a></li>');
  }
  document.getElementById('users').innerHTML = append.join('');
});
document.getElementById('messages').style.height = window.innerHeight - 170 + 'px';
document.getElementById('sendmessage').addEventListener('submit', function(e) {
  var data = {
    'name': document.getElementById('name').value,
    'message': document.getElementById('message').value
  }
  socket.emit('message', data);
  e.preventDefault();
  document.getElementById('message').value = '';
  return false;
});

var makeChatRow = function(data) {
  var date = new Date(data.timestamp);
  var display = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()
  return '<div class="message">' + '<b>' + data.from + ': </b>' + data.message + '<span class="pull-right badge">' + display + '</span></div>';
}
