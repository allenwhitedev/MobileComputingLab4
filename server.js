// RUN sudo killall -15 mongod if mongo does not close properly
 
/* Server.js
The main portion of this project. Contains all the defined routes for express,
rules for the websockets, and rules for the MQTT broker.
Refer to the portions surrounded by --- for points of interest */

var express   = require('express'),
	app       = express();
var pug       = require('pug');
var sockets   = require('socket.io');
var path      = require('path');

var conf      = require(path.join(__dirname, 'config'));
var internals = require(path.join(__dirname, 'internals'));

let mongodb = require('mongodb')
let MongoClient = mongodb.MongoClient

// -- Setup the application
setupExpress();
setupSocket();

// setup mongo
let mongoURL = 'mongodb://127.0.0.1:27017/labMongoDB'
setTimeout( () => 
{
	MongoClient.connect(mongoURL, (err, database) => 
	{
		if (err)
			return console.log(err)
		
		db = database
		let nodeURL = process.env.PORT || 8080
		console.log('setup mongoClient')
		app.listen(nodeURL, () => console.log("Mongo connected to node app at", nodeURL) )
	})
}, 5000)

setTimeout( () => 
{
	console.log('Testing mongo insert...')

	let testuser = 
	{
		name: "testuser1",
		activity: 0,
		createdAt: new Date(),
		friends: []
	}

	db.collection('guys').insert(testuser, (err, result) =>
	{
		if (err)
			console.log(err)
		console.log('ADDED ' + testuser + ' to database')
	})

	let testGuy = db.collection('guys').findOne({name: "testuser1"}, (err, doc) =>
	{
		if (err)
			console.log(err)
	}) || null

	console.log('testGuy', testGuy)
	//console.log('successful findOne() operation', testGuy.name, testGuy.activity, testGuy.createdAt)

}, 10000)
	
// -- Socket Handler
// Here is where you should handle socket/mqtt events
// The mqtt object should allow you to interface with the MQTT broker through 
// events. Refer to the documentation for more info 
// -> https://github.com/mcollina/mosca/wiki/Mosca-basic-usage
// ----------------------------------------------------------------------------
function socket_handler(socket, mqtt) {
	// Called when a client connects
	mqtt.on('clientConnected', client => {
		socket.emit('debug', {
			type: 'CLIENT', msg: 'New client connected: ' + client.id
		});
	});

	// Called when a client disconnects
	mqtt.on('clientDisconnected', client => {
		socket.emit('debug', {
			type: 'CLIENT', msg: 'Client "' + client.id + '" has disconnected'
		});
	});

	// Called when a client publishes data
	mqtt.on('published', (data, client) => {
		if (!client) return;

		socket.emit('debug', {
			type: 'PUBLISH', 
			msg: 'Client "' + client.id + '" published "' + JSON.stringify(data) + '"'
		});
	});

	// Called when a client subscribes
	mqtt.on('subscribed', (topic, client) => {
		if (!client) return;

		socket.emit('debug', {
			type: 'SUBSCRIBE',
			msg: 'Client "' + client.id + '" subscribed to "' + topic + '"'
		});
	});

	// Called when a client unsubscribes
	mqtt.on('unsubscribed', (topic, client) => {
		if (!client) return;

		socket.emit('debug', {
			type: 'SUBSCRIBE',
			msg: 'Client "' + client.id + '" unsubscribed from "' + topic + '"'
		});
	});
}
// ----------------------------------------------------------------------------


// Helper functions
function setupExpress() {
	app.set('view engine', 'pug'); // Set express to use pug for rendering HTML

	// Setup the 'public' folder to be statically accessable
	var publicDir = path.join(__dirname, 'public');
	app.use(express.static(publicDir));

	// Setup the paths (Insert any other needed paths here)
	// ------------------------------------------------------------------------
	// Home page
	app.get('/', (req, res) => {
		res.render('index', {title: 'MQTT Tracker'});
	});

	// Basic 404 Page
	app.use((req, res, next) => {
		var err = {
			stack: {},
			status: 404,
			message: "Error 404: Page Not Found '" + req.path + "'"
		};

		// Pass the error to the error handler below
		next(err);
	});

	// Error handler
	app.use((err, req, res, next) => {
		console.log("Error found: ", err);
		res.status(err.status || 500);

		res.render('error', {title: 'Error', error: err.message});
	});
	// ------------------------------------------------------------------------

	// Handle killing the server
	process.on('SIGINT', () => {
		internals.stop();
		process.kill(process.pid);
	});
}

function setupSocket() {
	var server = require('http').createServer(app);
	var io = sockets(server);

	// Setup the internals
	internals.start(mqtt => {
		io.on('connection', socket => {
			socket_handler(socket, mqtt)
		});
	});

	server.listen(conf.PORT, conf.HOST, () => { 
		console.log("Listening on: " + conf.HOST + ":" + conf.PORT);
	});
}