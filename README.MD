# Post-Comment App:
sample app for post-commenting functionality, featuring real time commenting between users.

### features
1. session management - with login, logout
2. add post
3. add comment
4. implementing web-sockets


### tech stack used
1. websockets - for real-time commenting system
2. node - v11.3.0
3. npm - 6.4.1
4. mongodb - 
```
db version v4.2.0
```

### how to run

1. npm install
2. create db and collection in mongo
    1. use pc-app (for the app)
        1. db.createCollection("posts")
        2. db.createCollection("comments")
    2. use pc-sessions (for express-sessions)
3. npm start


app runs on localhost:3000 (open in browser)
websocket server runs on localhost:8383