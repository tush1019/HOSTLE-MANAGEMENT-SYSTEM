import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

type UserLite = { id: number; name: string; email: string; role: string };
type Conversation = {
  partnerId: number;
  partnerName: string;
  partnerEmail: string;
  partnerRole: string;
  lastMessage: string;
  lastAt: string;
  lastSenderId: number | null;
  unread: number;
};
type Message = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  isRead: number;
  createdAt: string;
};

export default function Chat() {
  const me = (() => {
    try { return JSON.parse(localStorage.getItem("hostelUser") || "null"); } catch { return null; }
  })();

  const [contacts, setContacts] = useState<UserLite[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadContacts = async (q = "") => {
    try {
      const data = await api<UserLite[]>(`/chat/contacts?search=${encodeURIComponent(q)}`);
      setContacts(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load contacts");
    }
  };

  const loadConversations = async () => {
    try {
      const data = await api<Conversation[]>("/chat/conversations");
      setConversations(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load conversations");
    }
  };

  const loadMessages = async (partnerId: number) => {
    setMsgLoading(true);
    try {
      const data = await api<Message[]>(`/chat/messages?with=${partnerId}`);
      setMessages(data || []);
      await loadConversations();
    } catch (e: any) {
      setError(e.message || "Failed to load messages");
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadContacts(""), loadConversations()]);
      setLoading(false);
    })();
    const t = setInterval(loadConversations, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    if (activeId) {
      const t = setInterval(() => loadMessages(activeId), 5000);
      return () => clearInterval(t);
    }
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = (q: string) => {
    setSearch(q);
    loadContacts(q);
  };

  const startChat = (id: number) => {
    setActiveId(id);
    setMessages([]);
  };

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await api("/chat/messages", { method: "POST", body: { recipientId: activeId, body: draft.trim() } });
      setDraft("");
      await loadMessages(activeId);
      setToast("Message sent");
      setTimeout(() => setToast(""), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const activeContact = contacts.find((c) => c.id === activeId) ||
    conversations.find((c) => c.partnerId === activeId) && {
      id: activeId!,
      name: conversations.find((c) => c.partnerId === activeId)!.partnerName,
      email: conversations.find((c) => c.partnerId === activeId)!.partnerEmail,
      role: conversations.find((c) => c.partnerId === activeId)!.partnerRole,
    };

  const activeName = activeContact ? activeContact.name : "Conversation";

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading chat…</div>;
  }


  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">{toast}</div>}
      <div className="w-80 shrink-0 bg-white rounded-xl shadow flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Messages</h2>
          <input
            className="mt-2 w-full border rounded px-3 py-2 text-sm"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && contacts.filter((c) => !conversations.some((cv) => cv.partnerId === c.id)).length === 0 && (
            <div className="p-4 text-sm text-gray-500">No conversations yet.</div>
          )}
          {conversations.map((c) => (
            <button
              key={c.partnerId}
              onClick={() => startChat(c.partnerId)}
              className={`w-full text-left p-3 border-b hover:bg-[#F5F7FA] ${activeId === c.partnerId ? "bg-[#F0E6D2]" : ""}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium truncate">{c.partnerName}</span>
                {c.unread > 0 && (
                  <span className="bg-[#C9A96E] text-[#101828] text-xs px-2 py-0.5 rounded-full font-semibold">{c.unread}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">{c.lastMessage}</div>
            </button>
          ))}
          {contacts
            .filter((c) => !conversations.some((cv) => cv.partnerId === c.id))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => startChat(c.id)}
                className={`w-full text-left p-3 border-b hover:bg-[#F5F7FA] ${activeId === c.id ? "bg-[#F0E6D2]" : ""}`}
              >
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-gray-500 truncate">{c.email}</div>
              </button>
            ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow flex flex-col overflow-hidden">
        {activeId ? (
          <>
            <div className="p-4 border-b">
              <h3 className="font-bold">{activeName}</h3>
              {activeContact && <div className="text-xs text-gray-500">{activeContact.email}</div>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgLoading && messages.length === 0 && <div className="text-gray-500">Loading messages…</div>}
              {!msgLoading && messages.length === 0 && <div className="text-gray-500">No messages yet. Say hello!</div>}
              {messages.map((m) => {
                const mine = m.senderId === me?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-lg ${mine ? "bg-[#101828] text-white" : "bg-[#F5F7FA] text-[#101828] border border-[#E5E7EB]"}`}>
                      <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                      <div className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {error && <div className="px-4 text-red-600 text-sm">{error}</div>}
            <div className="p-4 border-t flex gap-2">
              <textarea
                className="flex-1 border rounded px-3 py-2 text-sm resize-none"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="bg-[#C9A96E] text-[#101828] px-4 py-2 rounded font-semibold disabled:opacity-50 hover:bg-[#B8965C]"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

