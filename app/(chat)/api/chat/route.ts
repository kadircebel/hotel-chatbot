import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getItemDetails, getStockCode } from '@/lib/db/queries';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // console.log('Gelen istek gövdesi:', body);

    let message: string | undefined;
    if (body.messages && Array.isArray(body.messages)) {
      const lastMessage = body.messages.findLast((msg: any) => msg.role === 'user');
      message = lastMessage?.content;
    } else if (typeof body === 'string') {
      message = body;
    } else if (body.message && typeof body.message === 'string') {
      message = body.message;
    } else if (body.content && typeof body.content === 'string') {
      message = body.content;
    }

    console.log("Kullanıcıdan gelen mesaj:", message);

    if (!message || typeof message !== 'string') {
      console.error('Geçersiz gövde:', body);
      return NextResponse.json({ error: 'Mesaj eksik veya geçersiz' }, { status: 400 });
    }
    
    const itemMatch = message.match(/(\w+)/);

    let responseText = '';

    if (itemMatch) {
      const itemName = itemMatch[0];
      const stock = await getStockCode(itemName);

      if (stock) {
        const details = await getItemDetails(stock._id);
        if (details) {
          responseText = `${details.itemName} (Kod: ${details.stockCode}) - Alternatifler: ${details.alternatives.join(', ')}`;
        } else {
          responseText = `${itemName} için detay bulunamadı.`;
        }
      } else {
        responseText = `${itemName} adında bir stok bulunamadı. Başka bir şey sorabilir misiniz?`;
      }

      const stream = new ReadableStream({
        start(controller) {
          const response = {
            id: Date.now().toString(),
            role: 'assistant',
            content: responseText,
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`));
          controller.close();
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: body.messages || [{ role: 'user', content: message }],
        stream: true,
      });

      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const response = {
                id: Date.now().toString(),
                role: 'assistant',
                content,
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`));
            }
          }
          controller.close();
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    console.error('API Hatası:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}