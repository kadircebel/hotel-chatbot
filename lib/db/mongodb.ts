import { MongoClient } from 'mongodb';

// Global nesnesine özel bir tip tanımı ekliyoruz
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  throw new Error('Lütfen MONGODB_URI environment değişkenini tanımlayın.');
}

if (process.env.NODE_ENV === 'development') {
  // Geliştirme ortamında global conexão’yu yeniden kullanıyoruz
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // Üretim ortamında her seferinde yeni bağlantı
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;