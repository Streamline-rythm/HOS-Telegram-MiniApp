import { useState, useEffect, useRef } from "react";
import { io, Socket } from 'socket.io-client';

import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RequestStatus } from "@/components/MessageHistory";
import { TemplateMessages } from "@/components/TemplateMessages";
import { CustomMessageInput } from "@/components/CustomMessageInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DriverRequest } from "@/types";
import driverAvatar from '@/assets/driver-avatar.png';
import { Activity, Truck } from "lucide-react";

// =============================================================================
const Index = () => {
  const socketRef = useRef<Socket | null>(null);
  const basicUrl = "https://hos-miniapp-backend-181509438418.us-central1.run.app";
  const webApp = window.Telegram?.WebApp as any || null;

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("templates");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [requests, setRequests] = useState<DriverRequest[]>([]);

  // -------------------- Fetch Telegram User Info --------------------
  const getTelegramUserInformation = (): string | undefined => {
    if (!webApp) {
      alert("❌ Telegram WebApp not available.");
      webApp?.close?.();
      return;
    }

    const user = webApp.initDataUnsafe?.user;
    if (user?.username) {
      return user.username;
    } else {
      webApp.showAlert("❌ User info not available", () => webApp.close());
    }
  };

  // -------------------- Verify Telegram User --------------------
  const verifyUser = async (username: string) => {
    try {
      const res = await fetch(`${basicUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: username }),
      });

      if (!res.ok) {
        webApp.showAlert("❌ Unauthorized access.", () => webApp.close());
      }
    } catch (err) {
      console.error("Error verifying user:", err);
      webApp.showAlert("❌ Something went wrong. Please try again.", () => webApp.close());
    }
  };

  // -------------------- Format Chat History --------------------
  const handleAllHistory = (allHistory: any[]) => {
    const cache: DriverRequest[] = [];

    allHistory.forEach(entry => {
      cache.push({
        request: entry.content,
        timestamp: entry.created_at,
        sender: "driver",
      });

      entry.replies?.forEach((item: any) => {
        cache.push({
          request: item.reply_content,
          timestamp: item.reply_at,
          sender: 'dispatcher',
        });
      });
    });

    setRequests(cache);
  };

  // -------------------- Load Chat History --------------------
  const getAllChatHistory = async (username: string) => {
    try {
      const res = await fetch(`${basicUrl}/messages?userId=${username}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      handleAllHistory(data);
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  };

  // -------------------- Initial App Load --------------------
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);

      const username = getTelegramUserInformation();
      if (!username) return;

      setUserId(username);
      await verifyUser(username);
      await getAllChatHistory(username);

      socketRef.current = io(basicUrl, {
        transports: ['websocket'],
        withCredentials: true,
      });

      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected:", socketRef.current?.id);
        socketRef.current?.emit('socket register', { username });
      });

      socketRef.current.on("disconnect", () => {
        console.log("❌ Socket disconnected");
      });

      socketRef.current.on('reply', (reply: { messageId: number; reply: string }) => {
        const newRequest: DriverRequest = {
          request: reply.reply,
          timestamp: new Date(),
          sender: "dispatcher",
        };
        setRequests(prev => [...prev, newRequest]);
        setActiveTab("status");
      });

      setIsLoading(false);
    };

    init();

    return () => {
      if (socketRef.current) {
        console.log("🔌 Disconnecting socket...");
        socketRef.current.disconnect();
      }
    };
  }, []);

  // -------------------- Send Message --------------------
  const handleSendRequest = (requestText: string) => {
    const username = getTelegramUserInformation();
    if (!username || !requestText) {
      webApp.showAlert("❌ Cannot send empty message or missing user.", () => webApp.close());
      return;
    }

    const newRequest: DriverRequest = {
      request: requestText,
      timestamp: new Date(),
      sender: "driver",
    };

    setRequests(prev => [...prev, newRequest]);
    setActiveTab("status");

    socketRef.current?.emit('chat message', {
      userId: username,
      content: requestText,
    });
  };

  // -------------------- Loading UI --------------------
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <div className="bg-gradient-primary text-primary-foreground p-4 shadow-soft flex-shrink-0">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="w-8 h-8 rounded-md" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 mx-4 mt-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        <div className="border-t bg-card p-4 mx-4 mb-4 mt-3 rounded-lg shadow-soft flex-shrink-0">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  }

  // -------------------- Main UI --------------------
  return (
    <div className="h-screen flex flex-col justify-center items-center bg-gray-900">
      <div className="h-full min-w-[350px] max-w-[800px] w-full bg-background flex flex-col relative overflow-y-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-3 shadow-soft flex-shrink-0">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={driverAvatar}
                  alt="Driver"
                  className="w-[50px] h-[50px] rounded-full border-2 border-primary-border"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full border-2 border-primary-border"></div>
              </div>
              <div>
                <h1 className="font-bold text-lg">HOS support</h1>
                <p className="text-sm opacity-85">Smart AI Communication</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col mx-4 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mt-2 flex-shrink-0">
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <Truck size={20} />
                Driver Requests
              </TabsTrigger>
              <TabsTrigger value="status" className="flex items-center gap-2">
                <Activity size={20} />
                Status
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="data-[state=active]:flex-1 mt-0 overflow-hidden min-h-0">
              <TemplateMessages onSendMessage={handleSendRequest} />
            </TabsContent>

            <TabsContent value="status" className="data-[state=active]:flex-1 flex flex-col mt-2 min-h-0">
              <RequestStatus requests={requests} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Input */}
        <div className="border bg-card p-4 mx-4 mb-4 mt-2 rounded-lg shadow-soft flex-shrink-0 z-50">
          <CustomMessageInput onSendMessage={handleSendRequest} />
        </div>
      </div>
    </div>
  );
};

export default Index;
