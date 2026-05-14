import React from 'react';
import {
  Plus,
  MessageSquare,
  History,
  Settings,
  Shield,
} from 'lucide-react';
import useChatStore from '../store/useChatStore';

const Sidebar = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createNewConversation,
  } = useChatStore();

  return (
    <aside className="w-72 glass border-r border-white/5 flex flex-col z-20">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
            <Shield className="text-white w-6 h-6" />
          </div>

          <div>
            <h1 className="font-bold text-xl tracking-tight">MedLens</h1>
            <p className="text-[10px] uppercase tracking-widest text-medical-400 font-semibold">
              Offline Intelligence
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            createNewConversation();
            try {
              await fetch('http://localhost:3001/api/cleanup', { method: 'POST' });
            } catch (err) {
              console.error('Cleanup failed:', err);
            }
          }}
          className="w-full flex items-center gap-2 justify-center py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300 group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          <span className="font-medium">New Consultation</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-2 mb-2">
          Recent Consultations
        </div>

        {conversations.map((conv) => (
          <button
            type="button"
            key={conv.id}
            onClick={() => setActiveConversation(conv.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeConversationId === conv.id
                ? 'bg-medical-500/10 text-medical-400 border border-medical-500/20'
                : 'hover:bg-white/5 text-slate-400 border border-transparent'
              }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium truncate">{conv.title}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-white/5 space-y-1">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all"
        >
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">History</span>
        </button>

        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;