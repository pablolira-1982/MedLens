import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {}, // { conversationId: [messages] }
  isStreaming: false,
  currentStreamingText: '',

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    }));
  },

  updateStreamingText: (text) => set({ currentStreamingText: text }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  createNewConversation: () => {
    const id = uuidv4();
    set((state) => ({
      activeConversationId: id,
      conversations: [{ id, title: 'New Consultation', date: new Date() }, ...state.conversations],
      messages: { ...state.messages, [id]: [] },
    }));
    return id;
  },
}));

export default useChatStore;
