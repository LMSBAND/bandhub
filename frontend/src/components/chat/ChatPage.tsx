import { useState, useCallback, useEffect, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useCollection } from "../../hooks/useFirestore";
import { useAuth } from "../../hooks/useAuth";
import { useBand } from "../../hooks/useBand";
import styles from "./ChatPage.module.css";

interface Channel {
  id: string;
  name: string;
  createdBy: string;
}

interface Message {
  id: string;
  text: string;
  author: string;
  authorUid: string;
  createdAt: { seconds: number } | null;
}

export function ChatPage() {
  const { user } = useAuth();
  const { activeBand } = useBand(user?.uid);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [channelName, setChannelName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const bandId = activeBand?.id;

  const { data: channels } = useCollection<Channel>({
    path: bandId ? `bands/${bandId}/channels` : "",
    constraints: [orderBy("name", "asc")],
    enabled: !!bandId,
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannel) {
      setActiveChannel(channels[0].id);
    }
  }, [channels, activeChannel]);

  // Listen to messages in the active channel
  useEffect(() => {
    if (!bandId || !activeChannel || !db) return;

    const q = query(
      collection(db, `bands/${bandId}/channels/${activeChannel}/messages`),
      orderBy("createdAt", "asc"),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
      }));
      setMessages(msgs);
    });

    return unsub;
  }, [bandId, activeChannel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!bandId || !activeChannel || !user || !db || !newMessage.trim()) return;

    await addDoc(
      collection(db, `bands/${bandId}/channels/${activeChannel}/messages`),
      {
        text: newMessage.trim(),
        author: user.displayName ?? user.email ?? "Unknown",
        authorUid: user.uid,
        createdAt: serverTimestamp(),
      }
    );
    setNewMessage("");
  }, [bandId, activeChannel, user, newMessage]);

  const handleCreateChannel = useCallback(async () => {
    if (!bandId || !user || !db || !channelName.trim()) return;

    // Strip # and spaces, lowercase
    const name = channelName.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
    if (!name) return;

    const ref = await addDoc(collection(db, `bands/${bandId}/channels`), {
      name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    setChannelName("");
    setShowNewChannel(false);
    setActiveChannel(ref.id);
  }, [bandId, user, channelName]);

  const handleDeleteChannel = useCallback(
    async (channelId: string) => {
      if (!bandId || !db) return;
      if (!confirm("Delete this channel and all its messages?")) return;
      await deleteDoc(doc(db, `bands/${bandId}/channels`, channelId));
      if (activeChannel === channelId) {
        setActiveChannel(channels.find((c) => c.id !== channelId)?.id ?? null);
      }
    },
    [bandId, activeChannel, channels]
  );

  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);

  if (!activeBand) {
    return <div>Select a band to view chat.</div>;
  }

  const activeChannelData = channels.find((c) => c.id === activeChannel);

  const formatTime = (ts: { seconds: number } | null) => {
    if (!ts) return "";
    const d = new Date(ts.seconds * 1000);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  const formatDate = (ts: { seconds: number } | null) => {
    if (!ts) return "";
    const d = new Date(ts.seconds * 1000);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Group messages by date
  let lastDate = "";

  return (
    <div className={styles.page}>
      {/* Channel list */}
      <div className={styles.channelList}>
        <div className={styles.channelHeader}>
          <h3>Channels</h3>
          <button
            className={styles.addBtn}
            onClick={() => setShowNewChannel(true)}
            title="New channel"
          >
            +
          </button>
        </div>

        {showNewChannel && (
          <div className={styles.newChannel}>
            <input
              type="text"
              placeholder="#topic-name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateChannel();
                if (e.key === "Escape") setShowNewChannel(false);
              }}
              className={styles.channelInput}
              autoFocus
            />
          </div>
        )}

        {channels.map((ch) => (
          <div
            key={ch.id}
            className={`${styles.channelItem} ${ch.id === activeChannel ? styles.channelActive : ""}`}
            onClick={() => setActiveChannel(ch.id)}
          >
            <span className={styles.hash}>#</span>
            <span className={styles.channelName}>{ch.name}</span>
            <button
              className={styles.deleteChannelBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteChannel(ch.id);
              }}
              title="Delete channel"
            >
              x
            </button>
          </div>
        ))}

        {channels.length === 0 && !showNewChannel && (
          <p className={styles.noChannels}>
            No channels yet. Click + to create one!
          </p>
        )}
      </div>

      {/* Mobile channel picker */}
      <div className={styles.mobileChannelBar}>
        <button
          className={styles.mobileChannelBtn}
          onClick={() => setMobileChannelsOpen(!mobileChannelsOpen)}
        >
          <span className={styles.hash}>#</span>
          <span>{activeChannelData?.name ?? "Select channel"}</span>
          <span className={styles.mobileChevron}>{mobileChannelsOpen ? "\u25B2" : "\u25BC"}</span>
        </button>
        <button
          className={styles.addBtn}
          onClick={() => setShowNewChannel(true)}
          title="New channel"
        >
          +
        </button>
      </div>

      {mobileChannelsOpen && (
        <div className={styles.mobileChannelDropdown}>
          {showNewChannel && (
            <div className={styles.newChannel}>
              <input
                type="text"
                placeholder="#topic-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { handleCreateChannel(); setMobileChannelsOpen(false); }
                  if (e.key === "Escape") { setShowNewChannel(false); setMobileChannelsOpen(false); }
                }}
                className={styles.channelInput}
                autoFocus
              />
            </div>
          )}
          {channels.map((ch) => (
            <div
              key={ch.id}
              className={`${styles.channelItem} ${ch.id === activeChannel ? styles.channelActive : ""}`}
              onClick={() => { setActiveChannel(ch.id); setMobileChannelsOpen(false); }}
            >
              <span className={styles.hash}>#</span>
              <span className={styles.channelName}>{ch.name}</span>
            </div>
          ))}
          {channels.length === 0 && !showNewChannel && (
            <p className={styles.noChannels}>No channels yet. Tap + to create one!</p>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className={styles.chatArea}>
        {activeChannelData ? (
          <>
            <div className={styles.chatHeader}>
              <span className={styles.chatTitle}>#{activeChannelData.name}</span>
            </div>

            <div className={styles.messageList}>
              {messages.length === 0 ? (
                <div className={styles.emptyChat}>
                  No messages yet in #{activeChannelData.name}. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => {
                  const dateStr = formatDate(msg.createdAt);
                  let showDateDivider = false;
                  if (dateStr !== lastDate) {
                    lastDate = dateStr;
                    showDateDivider = true;
                  }

                  return (
                    <div key={msg.id}>
                      {showDateDivider && (
                        <div className={styles.dateDivider}>
                          <span>{dateStr}</span>
                        </div>
                      )}
                      <div className={styles.message}>
                        <div className={styles.msgHeader}>
                          <span className={styles.msgAuthor}>{msg.author}</span>
                          <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>
                        </div>
                        <p className={styles.msgText}>{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputBar}>
              <input
                type="text"
                placeholder={`Message #${activeChannelData.name}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className={styles.messageInput}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            {channels.length === 0
              ? "Create a channel to start chatting!"
              : "Select a channel to view messages."}
          </div>
        )}
      </div>
    </div>
  );
}
