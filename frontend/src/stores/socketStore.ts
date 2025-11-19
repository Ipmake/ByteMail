import { create } from "zustand"; 
import { Socket } from "socket.io-client";

interface SocketStore {
  socket: Socket | null;
  setSocket: (socket: Socket) => void;
  clearSocket: () => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
  socket: null,
  setSocket: (socket: Socket) => set({ socket }),
  clearSocket: () => set({ socket: null }),
}));