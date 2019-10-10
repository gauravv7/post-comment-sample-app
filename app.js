const http = require("http");
const uuid = require('uuid');
const url = require('url-parse');
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const port = process.env.port || 3000;
const DATABASE = 'pc-app';
const SESSION_DATABASE = 'pc-sessions';
const MONGO_URL = 'mongodb://localhost/';


var mongoose = require('mongoose');
// DB connection
mongoose.Promise = global.Promise;
mongoose.connect(MONGO_URL+DATABASE, { useNewUrlParser: true,  useUnifiedTopology: true })
.then(() => console.log('connection succesful'))
.catch((err) => console.error(err));
// DB connection end

const app = new express();

app.use(express.static(__dirname + "/public" ));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var Posts = require('./models/post');
var Comments = require('./models/comment');
 
 
// ttl = 1 days
const mongoStoreOptions = { 
    url: MONGO_URL+SESSION_DATABASE, 
    ttl: 1 * 24 * 60 * 60, 
    touchAfter: 24 * 3600,
    secret: 'mysessionsecret'
};
var store = new MongoStore(mongoStoreOptions);
var sessionParser = session({
    secret: 'mysessionsecret',
    resave: false,
    saveUninitialized: true,
    store: store,
    cookie: { secure: false, maxAge: 60000 }
})
app.use(sessionParser);
app.set('view engine', 'ejs');

function validateLoginAndShowPage(req, res, page) {
    if(req.session.userId!==undefined && req.session.id!=undefined) {
       res.render(page);
    } else {
        res.redirect('/login');
    }
}

function validateLoginAndRedirectPage(req, res, page) {
    if(req.session.userId!==undefined && req.session.id!=undefined) {
       res.redirect(page);
    } else {
        res.redirect('/login');
    }
}

app.get('/',function(req,res){
    validateLoginAndRedirectPage(req, res, "/posts");
});

app.get('/posts',function(req,res){
     Posts.find({}, function(err, posts) {
      if (err) {
        console.log(err);
      } else {
        res.render('posts', { posts: posts });
      }
    }); 
});

app.get('/add-post',function(req,res){
    validateLoginAndShowPage(req, res, "add-post");
});

app.post('/add-new-post',function(req,res){
    var data = req.body;
    if(data.type=="post") {
        var postData = new Posts({title: data.title, userName: req.session.userName});
        postData.save();
        res.redirect("/posts");
    }
});

app.get('/login', function(req, res) {
    if(req.session.userId!==undefined && req.session.id!=undefined) {
        res.redirect('/posts');
    }
    res.render("login");
});

app.post('/login-processing', function(req, res){
    const id = uuid.v4();
    req.session.userId = id;
    req.session.userName = req.body.username;
    res.redirect("/");
});


app.get('/logout', function(request, response) {
    if(request.session.userId!==undefined && request.session.id!=undefined) {
        console.log('Destroying session');
        request.session.destroy(function() {
          response.redirect("/login");
        });
    } else {
        response.redirect("/login");
    }
});

app.get('/posts/detail/:id',function(req,res){
    Posts.findById(req.params.id, function (err, postDetail) {
        if (err) {
          console.log(err);
        } else {
            Comments.find({'postId':req.params.id}, function (err, comments) {
                res.render('post-detail', { postDetail: postDetail, comments: comments, userName: req.session.userName, postId: req.params.id });
            });
        }
    }); 
});


const server = http.createServer(app);
const wss = new WebSocket.Server({
  port: 8383,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }
});
 
wss.on('connection', function(ws, request) {
    ws.upgradeReq = request;
    let sid;
    let response = {
        writeHead : {}
    };
    sessionParser(request, response, function(err) {
        sid = request.session.id;
        const id = uuid.v4();
        request.session.userId = id;
        console.log('Connection received with sessionId ' + sid);
        ws.on('message', function incoming(message) {
            var data = JSON.parse(message);
            if(data.type=="comment") {
                console.log("comment %s", data.message);
                console.log("username %s", request.session.userName);
                console.log("postId %s", data.postId);
                var commentData = new Comments({"comment": data.message, "userName": request.session.userName, "postId": data.postId});
                commentData.save();
                data["userName"] = request.session.userName;
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
            console.log('received: %s, %s, %s, %s', message, sid, request.session.id, request.session.userId);
        });
    });
});

server.listen(port,function(){
    console.log("Server running at port "+ port);
});