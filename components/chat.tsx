'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from 'ai/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: (message) => {
      console.log('Yanıt alındı:', message); // API’den gelen son mesaj
      console.log('Güncel mesajlar:', messages); // Mesaj dizisi
      mutate('/api/history');
    },
    onError: (error) => {
      console.error('useChat Hatası (Tam Mesaj):', error.message, error.stack);
      // toast.error('An error occured, please try again!');
    },
    onResponse: async (response) => {
      console.log('API Yanıtı Alındı:', response.status, response.statusText);
    
      const reader = response.body?.getReader(); // Akışın reader'ını alıyoruz
      if (!reader) {
        console.error('Akış başlatılamadı, body yok.');
        return;
      }
    
      const decoder = new TextDecoder();
      let text = '';
    
      try {
        // Akıştan gelen veriyi okuyoruz
        while (true) {
          const { done, value } = await reader.read();  // Akıştan veriyi okuruz
          if (done) break;  // Eğer akış tamamlanmışsa döngüyü kırarız
          text += decoder.decode(value, { stream: true });  // Veriyi çöz ve ekle
        }
    
        console.log('Ham Yanıt:', text); // Tam yanıtı burada görüyorsunuz
    
        // Akışı bitirdikten sonra gelen metni işleme
        const lines = text.split('\n');
        lines.forEach((line) => {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(6).trim(); // "data: " kısmı çıkarılıyor
            try {
              const parsedResponse = JSON.parse(jsonData);
              console.log('JSON Veri:', parsedResponse);
    
              if (parsedResponse.role && parsedResponse.content) {
                // Mesajları güncelle
                setMessages((prevMessages) => [
                  ...prevMessages,
                  {
                    id: generateUUID(),
                    role: parsedResponse.role,
                    content: parsedResponse.content,
                  },
                ]);
              }
            } catch (error) {
              console.error('JSON parsing hatası:', error);
            }
          } 
        });
      } catch (error) {
        console.error('Akış okuma hatası:', error);
      }
    },
    
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        {/* Geçici render testi */}
        {/* <div>
          {messages.map((msg) => (
            <p key={msg.id}>{msg.role}: {msg.content}</p>
          ))}
        </div> */}

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}