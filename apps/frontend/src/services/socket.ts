
import { io } from 'socket.io-client';

// Gateway Service URL
const URL = window.location.origin;

export const socket = io(URL, {
    autoConnect: false,
    transports: ['websocket']
});

export const connectSocket = () => {
    if (!socket.connected) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
