// MARK: Imports
import ws from 'ws';

// MARK: Constants
const PORT = Number(process.env.PORT || 8080);

// MARK: Types
type User = {
    username: string;
    socket: ws.WebSocket;
}

type ChatMessage = {
    username: string;
    message: string;
}

// MARK: Constants
const users: User[] = [];
const chatHistory: ChatMessage[] = [];

// MARK: Methods 
const findUser = (username: string) => {
    return users.find(user => user.username === username);
}

const saveUser = (username: string, ws: ws.WebSocket) => {
    const cleanUsername = username.trim().toLowerCase();
    const existingUser = findUser(cleanUsername);
    const userObject = { 
        username: cleanUsername,
        socket: ws
    };
    if (existingUser) {
        throw new Error('Username already exists');
    }
    users.push(userObject);
    return userObject;
}

const broadcast = (message: string, omit?: string) => {
    users.forEach(user => {
        if(omit && user.username === omit) {
            return;
        }
        user.socket.send(message);
    });
}

const dm = (message: string, toUsername: string, fromUsername: string) => {
    const toUser = findUser(toUsername);
    if(!toUser) {
        return;
    }
    toUser.socket.send(`[DM] [${fromUsername}]: ${message}`);
}

// MARK: Websocket Server Listener
const wss = new ws.Server({ port: PORT });
console.log(`Server started on port ${PORT}`);

// MARK: Websocket Server Event Handlers
wss.on('connection', (ws: ws.WebSocket) => {

    let username: string;

    ws.send('Welcome to the chat server, please set a username.');

    console.log('Client connected');

    // Message
    ws.on('message', (message: ws.Data) => { 
        if(!username) {
            try {
                username = saveUser(message.toString(), ws).username;
            } catch(e) {
                ws.send("Username already exists, please try again.");
                return;
            }
            ws.send(`Welcome ${username}`);
            broadcast(`${username} has joined the chat.`);

            // Send last 10 items in chat history to user
            chatHistory.slice(-10).forEach(chatMessage => {
                ws.send(`[${chatMessage.username}]: ${chatMessage.message}`);
            });
            
            console.log('User List', users);
            return;
        }

        // Direct Message
        if(message.toString().startsWith('@')) {
            // Split the message into an array @ is the delimiter and the first element is the username
            const [toUsername, ...messageParts] = message.toString().split(' ');
            const messageToSend = messageParts.join(' ');
            const userToDM = toUsername.slice(1);
            dm(messageToSend, userToDM, username);
            return;
        }

        const chatMessage = {
            username,
            message: message.toString()
        };

        chatHistory.push(chatMessage);
        broadcast(`[${chatMessage.username}]: ${chatMessage.message}`, chatMessage.username);
    });


    // Close
    ws.on('close', () => {
        if(username) {
            broadcast(`${username} has left the chat.`);
            // Remove user from list by username 
            // Find the user and their index in the array
            // And then remove them from the array based on index 
            const userIndex = users.findIndex(user => user.username === username);
            users.splice(userIndex, 1);
        }
        console.log('Client disconnected');
    });

});