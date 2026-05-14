import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import useChatStore from './store/useChatStore';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function App() {
  const {
    activeConversationId,
    createNewConversation,
    addMessage,
    setStreaming,
    updateStreamingText,
  } = useChatStore();

  const typingQueueRef = useRef('');
  const typedTextRef = useRef('');
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      createNewConversation();
    }
  }, [activeConversationId, createNewConversation]);

  useEffect(() => {
    const typingInterval = setInterval(() => {
      if (typingQueueRef.current.length === 0) return;

      const char = typingQueueRef.current[0];
      typingQueueRef.current = typingQueueRef.current.slice(1);

      typedTextRef.current += char;
      updateStreamingText(typedTextRef.current);
    }, 20);

    socket.on('ai_token', ({ conversationId, token }) => {
      if (conversationId !== activeConversationRef.current) return;

      setStreaming(true);
      typingQueueRef.current += token;
    });

    socket.on('ai_complete', ({ conversationId, fullText }) => {
      if (conversationId !== activeConversationRef.current) return;

      const finishTyping = setInterval(() => {
        if (typingQueueRef.current.length > 0) return;

        clearInterval(finishTyping);

        const finalText = fullText || typedTextRef.current;

        addMessage(conversationId, {
          role: 'assistant',
          content: finalText,
          id: Date.now(),
        });

        typedTextRef.current = '';
        typingQueueRef.current = '';

        updateStreamingText('');
        setStreaming(false);
      }, 50);
    });

    return () => {
      clearInterval(typingInterval);
      socket.off('ai_token');
      socket.off('ai_complete');
    };
  }, [addMessage, setStreaming, updateStreamingText]);

  const handleSendMessage = async (content) => {
    if (!activeConversationId) return;

    addMessage(activeConversationId, {
      role: 'user',
      content,
      id: Date.now(),
    });

    typedTextRef.current = '';
    typingQueueRef.current = '';
    updateStreamingText('');
    setStreaming(true);

    socket.emit('send_message', {
      conversationId: activeConversationId,
      text: content,
    });
  };

  return (
    <div className="h-screen w-screen flex medical-gradient overflow-hidden">
      <Sidebar />
      <ChatWindow onSendMessage={handleSendMessage} />
    </div>
  );
}

export default App;