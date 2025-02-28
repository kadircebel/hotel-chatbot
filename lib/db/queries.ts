import clientPromise from './mongodb';
import { Document } from 'mongodb';

// Stok ile ilgili tipler
interface StockCode {
  _id: string;
  itemName: string;
}

interface ItemDetails {
  stockCode: string;
  itemName: string;
  category: string;
  alternatives: string[];
}

// Kullanıcı tipi
interface User extends Document {
  _id: string;
  email: string;
  password: string;
}

// Chat ve Message tipleri
interface Chat extends Document {
  _id: string;
  createdAt: string;
  title: string;
  userId: string;
  visibility: 'public' | 'private';
}

interface Message extends Document {
  _id: string;
  chatId: string;
  role: string;
  content: string;
  createdAt: string;
}

// Vote tipi
interface Vote extends Document {
  _id: string;
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}

// Suggestion tipi
interface Suggestion extends Document {
  _id: string;
  documentId: string;
  originalText: string;
  suggestedText: string;
  description?: string;
  isResolved: boolean;
  userId: string;
  createdAt: string;
}


function normalizeTurkishChars(str: string): string {
  return str
    .toLowerCase()
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getStockCodesForCategory(categoryName: string): Promise<string> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  
  // Normalize the category name
  const normalizedCategory = normalizeTurkishChars(categoryName.trim());
  
  // Look for matching stocks for the category
  const stocks = await db.collection('stock-codes').find({
    category: { $regex: new RegExp(normalizedCategory, 'i') }
  }).toArray();

  let responseText = '';
  
  // Iterate through each stock and get its details
  for (const stock of stocks) {
    const details = await getItemDetails(stock.stockCode);
    if (details) {
      responseText += `${details.itemName} (Kod: ${details.stockCode}) - Alternatifler: ${details.alternatives.join(', ')}\n`;
    }
  }

  return responseText;
}


// export async function getStockCode(itemName: string): Promise<StockCode | null> {
//   const client = await clientPromise;
//   const db = client.db('stockDb');
  
//   // Check if it's a stock code first (e.g., FISH001)
//   if (/^FISH\d+$/i.test(itemName)) {
//     return await db.collection('stock-codes').findOne({ 
//       stockCode: itemName.toUpperCase() 
//     }) as StockCode | null;
//   }
  
//   // Otherwise, search by normalized item name
//   const normalizedItemName = normalizeTurkishChars(itemName.trim());
  
//   // Try exact match on itemName first
//   let stock = await db.collection('stock-codes').findOne({
//     itemName: { $regex: new RegExp(`^${normalizedItemName}$`, 'i') }
//   });
  
//   // If no match, try partial match
//   if (!stock) {
//     stock = await db.collection('stock-codes').findOne({
//       itemName: { $regex: new RegExp(normalizedItemName, 'i') }
//     });
//   }
  
//   return stock as StockCode | null;
// }

// export async function getFishTypes(question: string): Promise<StockCode[]> {
//   // If the question is about fish types
//   if (question.toLowerCase().includes('balık') && 
//       (question.toLowerCase().includes('türleri') || 
//        question.toLowerCase().includes('çeşitleri'))) {
    
//     // Get all fish
//     return await getStockCodesForCategory('Balık');
//   }
  
//   // If the question is about seafood types
//   if ((question.toLowerCase().includes('deniz') && 
//        question.toLowerCase().includes('ürünleri')) ||
//       question.toLowerCase().includes('seafood')) {
    
//     // Get all seafood
//     return await getStockCodesForCategory('Deniz Ürünleri');
//   }
  
//   return [];
// }


// // Stok sorguları
export async function getItemDetails(stockCode: string): Promise<ItemDetails | null> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  // const item = await db.collection('item-details').findOne({ stockCode });
  const item = await db.collection('item-details').findOne({ 
    stockCode: { $regex: new RegExp('^' + stockCode.toLowerCase(), 'i') }
  });
  console.log('item:', item);
  return item as ItemDetails | null;
}


export async function getStockCode(itemName: string): Promise<StockCode | null> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  // const stock = await db.collection('stock-codes').findOne({ itemName });
  const normalizedItemName = normalizeTurkishChars(itemName.toLowerCase());
  const stock = await db.collection('stock-codes').findOne({
    itemName: { $regex: new RegExp(normalizedItemName, 'i') }
  });
  
  return stock as StockCode | null;
}

// Kullanıcı sorguları
export async function createUser(email: string, password: string): Promise<User> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const user: User = {
    _id: new Date().toISOString(),
    email,
    password,
  };
  await db.collection<User>('users').insertOne(user);
  return user;
}

export async function getUser(email: string): Promise<User | null> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const user = await db.collection<User>('users').findOne({ email });
  return user as User | null;
}

// Chat ve Mesaj sorguları
export async function deleteMessagesByChatIdAfterTimestamp(chatId: string, timestamp: string): Promise<void> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  await db.collection<Message>('message').deleteMany({ chatId, createdAt: { $gt: timestamp } });
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const message = await db.collection<Message>('message').findOne({ _id: messageId });
  return message as Message | null;
}

export async function getMessagesByChatId({ id: chatId }: { id: string }): Promise<Message[]> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const messages = await db.collection<Message>('message').find({ chatId }).toArray();
  return messages;
}

export async function updateChatVisiblityById(chatId: string, visibility: 'public' | 'private'): Promise<void> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  await db.collection<Chat>('chat').updateOne({ _id: chatId }, { $set: { visibility } });
}

// Vote sorguları
export async function getVotesByChatId({ id: chatId }: { id: string }): Promise<Vote[]> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const votes = await db.collection<Vote>('vote').find({ chatId }).toArray();
  return votes;
}

export async function voteMessage({ chatId, messageId, type }: { chatId: string; messageId: string; type: 'up' | 'down' }): Promise<void> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const isUpvoted = type === 'up';
  await db.collection<Vote>('vote').updateOne(
    { chatId, messageId },
    { $set: { isUpvoted, _id: `${chatId}-${messageId}` } },
    { upsert: true }
  );
}

// Chat geçmişini alma
export async function getChatsByUserId({ id: userId }: { id: string }): Promise<Chat[]> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const chats = await db.collection<Chat>('chat').find({ userId }).toArray();
  return chats;
}

// Belirli bir chat’i ID’ye göre alma
export async function getChatById({ id }: { id: string }): Promise<Chat | null> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const chat = await db.collection<Chat>('chat').findOne({ _id: id });
  return chat as Chat | null;
}

// Suggestion sorgusu
export async function getSuggestionsByDocumentId(documentId: string): Promise<Suggestion[]> {
  const client = await clientPromise;
  const db = client.db('stockDb');
  const suggestions = await db.collection<Suggestion>('suggestion').find({ documentId }).toArray();
  return suggestions;
}